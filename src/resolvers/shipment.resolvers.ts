import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { GetShipmentInput, ShipmentInput } from '@inputs/shipment.input'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { find, get, map, omit, sortBy, sum } from 'lodash'
import {
  PublicTrackingPayload,
  ShipmentListPayload,
  ShipmentTimeCheckPayload,
  TotalRecordPayload,
} from '@payloads/shipment.payloads'
import { LoadmoreArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { GET_SHIPMENT_LIST } from '@pipelines/shipment.pipeline'
import { clearLimiter, ELimiterType } from '@configs/rateLimit'
import { shipmentNotifyQueue } from '@configs/jobQueue'
import { EPaymentMethod } from '@enums/payments'
import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { EUserRole } from '@enums/users'
import { CalculationInput, UpdateShipmentInput } from '@inputs/booking.input'
import RetryTransactionMiddleware, { WithTransaction } from '@middlewares/RetryTransaction'
import { createShipment, updateShipment } from '@controllers/shipment'
import { calculateExistingQuotation, calculateQuotation, calculateStep } from '@controllers/quotation'
import { CalculateQuotationResultPayload, EditQuotationResultPayload } from '@payloads/quotation.payloads'
import { shipmentNotify } from '@controllers/shipmentNotification'
import { VALUES } from 'constants/values'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import AdditionalServiceModel from '@models/additionalService.model'
import { EServiceStatus } from '@enums/additionalService'
import { PricingCalculationMethodPayload } from '@payloads/pricing.payloads'
import { AuditLogDecorator } from 'decorators/AuditLog.decorator'
import { EAuditActions } from '@enums/audit'
import { differenceInMinutes } from 'date-fns'
import { handleUpdateBookingTime } from '@controllers/shipmentOperation'
import { StepDefinition } from '@models/shipmentStepDefinition.model'
import { Destination } from '@models/shipment/objects'

Aigle.mixin(lodash, {})

@Resolver(Shipment)
export default class ShipmentResolver {
  @Query(() => Shipment)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async getShipmentByTracking(
    @Ctx() ctx: GraphQLContext,
    @Arg('trackingNumber') trackingNumber: string,
  ): Promise<Shipment> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const shipment = await ShipmentModel.findOne({
        trackingNumber,
        ...(user_role === EUserRole.CUSTOMER ? { customer: user_id } : {}),
      })
      if (!shipment) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      const _steps = sortBy(shipment.steps, ['seq'])
      return Object.assign(shipment, { steps: _steps })
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async continueMatchingShipment(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const user_id = ctx.req.user_id
    const shipment = await ShipmentModel.findOne({ _id: shipmentId, customer: user_id })

    if (!shipment || !shipment.isNotificationPause) {
      throw new GraphQLError('ไม่สามารถดำเนินการต่อได้ในขณะนี้')
    }

    const currentNotificationCount = shipment.notificationCount || 0

    // หากเป็นการค้นหาครั้งที่ 2 (หลังจาก favorite driver ไม่ตอบรับ หรือ general broadcast รอบแรกหมด)
    if (currentNotificationCount === 1) {
      await shipment.updateOne({
        isNotificationPause: false,
        notificationCount: 2, // อัปเดต stage
      })
      await shipmentNotifyQueue.add({
        shipmentId,
        stage: 'SECOND_BROADCAST',
        iteration: 1,
      })
      return true
    }

    // ในกรณีอื่นๆ อาจต้องมี logic เพิ่มเติม
    // เช่น ถ้า favorite driver ไม่รับ แล้วลูกค้ากดค้นหาต่อ
    const isFavoriteDriverFail = shipment.requestedDriver && currentNotificationCount === 0
    if (isFavoriteDriverFail) {
      await shipment.updateOne({
        isNotificationPause: false,
        notificationCount: 1, // อัปเดต stage เป็น general broadcast
      })
      await shipmentNotifyQueue.add({
        shipmentId,
        stage: 'INITIAL_BROADCAST',
        iteration: 1,
      })
      return true
    }

    return false
  }

  @Mutation(() => Shipment)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  @UseMiddleware(
    AuditLogDecorator({
      action: EAuditActions.CREATE_SHIPMENT,
      entityType: 'Shipment',
      entityId: (root, args, context, info) => {
        // You'll need to capture the trackingNumber AFTER createShipment
        // For now, if createShipment returns the entity, you can access it here.
        // Or, if the entityId is generated in the controller, it might be part of the result.
        // A common pattern is to return the created entity directly from the resolver.
        // If the resolver returns `Shipment`, then `result` in decorator will be the Shipment object.
        return info.returnType.name === 'Shipment' && info.result ? info.result.trackingNumber : undefined
      },
      details: (root, args) => ({
        pickupLocation: get(args.data.locations, '0.name'),
        deliveryLocationsCount: args.data.locations.length - 1,
        vehicleType: args.data.vehicleId,
        paymentMethod: args.data.paymentMethod,
        isRoundedReturn: args.data.isRoundedReturn,
      }),
    }),
  )
  async createShipment(@Arg('data') data: ShipmentInput, @Ctx() ctx: GraphQLContext): Promise<Shipment> {
    const session = ctx.session
    const customerId = ctx.req.user_id

    const shipmentResponse = await createShipment(data, customerId, session)
    if (shipmentResponse) {
      if (session) {
        await session.commitTransaction()
      }
      const shipment = await ShipmentModel.findById(shipmentResponse._id).session(session).lean()
      if (shipment.paymentMethod === EPaymentMethod.CREDIT) {
        await shipmentNotify(shipment._id)
      }
      await clearLimiter(ctx.ip, ELimiterType.LOCATION, customerId)
    }
    return shipmentResponse
  }

  @Mutation(() => EditQuotationResultPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async calculateExistingShipment(@Arg('data') data: CalculationInput): Promise<EditQuotationResultPayload> {
    try {
      const pricing = await calculateExistingQuotation(data)
      return pricing
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => CalculateQuotationResultPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async calculateShipment(@Arg('data') data: CalculationInput): Promise<CalculateQuotationResultPayload> {
    try {
      const _quotation = await calculateQuotation(data, '')
      return _quotation
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  @UseMiddleware(
    AuditLogDecorator({
      action: EAuditActions.UPDATE_SHIPMENT,
      entityType: 'Shipment',
      entityId: (root, args) => args.data.shipmentId,
      details: (root, args) => ({ updatedFields: args.data }),
    }),
  )
  async updateShipment(@Arg('data') data: UpdateShipmentInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const user_id = ctx.req.user_id
      const session = ctx.session
      await updateShipment(data, user_id, session)
      return true
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => PricingCalculationMethodPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getCalculationDetail(@Arg('shipmentId') shipmentId: string): Promise<PricingCalculationMethodPayload> {
    try {
      const _shipment = await ShipmentModel.findById(shipmentId) //.lean()

      const distanceAsKM = _shipment.distance / 1000
      const _outbound = calculateStep(distanceAsKM, _shipment.formula)
      let _return = { cost: 0, price: 0, percentCost: 0, percentPrice: 0 }
      let _droppoint = { cost: 0, price: 0 }

      console.log('_outbound: ==> ', _outbound)

      if (_shipment.isRoundedReturn) {
        const _existingCost = find(_shipment.additionalServices, [
          'reference.additionalService.name',
          VALUES.ROUNDED_RETURN,
        ]) as ShipmentAdditionalServicePrice | undefined
        const returnedDistanceAsKM = _shipment.returnDistance / 1000
        const _returnOutbound = calculateStep(returnedDistanceAsKM, _shipment.formula)
        if (_existingCost) {
          const _costPercent = _existingCost.cost / 100
          const _pricePercent = _existingCost.price / 100
          _return = {
            cost: _returnOutbound.cost * _costPercent,
            price: _returnOutbound.price * _pricePercent,
            percentCost: _costPercent,
            percentPrice: _pricePercent,
          }
        } else {
          const _additionalService = await AdditionalServiceModel.findOne({
            name: VALUES.ROUNDED_RETURN,
            status: EServiceStatus.ACTIVE,
          }).lean()
          if (_additionalService) {
            const _additionalServiceCostPrice = await AdditionalServiceCostPricingModel.findOne({
              additionalService: _additionalService._id,
              available: true,
            })
            const _costPercent = (_additionalServiceCostPrice?.cost || 0) / 100
            const _pricePercent = (_additionalServiceCostPrice?.price || 0) / 100
            _return = {
              cost: _returnOutbound.cost * _costPercent,
              price: _returnOutbound.price * _pricePercent,
              percentCost: _costPercent,
              percentPrice: _pricePercent,
            }
          }
        }
      }

      const totalCost = sum([_outbound.cost, _return.cost])
      const totalPrice = sum([_outbound.price, _return.price])
      return {
        calculations: _outbound.calculations,
        subTotalDropPointCost: _droppoint.cost, // Alway 0
        subTotalDropPointPrice: _droppoint.price, // Alway 0
        roundedCostPercent: _return.percentCost,
        roundedPricePercent: _return.percentPrice,
        subTotalRoundedCost: _return.cost,
        subTotalRoundedPrice: _return.price,
        subTotalCost: _outbound.cost, // This is not sub total; there is distance outbound cost
        subTotalPrice: _outbound.price, // This is not sub total there is distance outbound price
        totalPrice: totalPrice,
        totalCost: totalCost,
        totalTax: 0, // Set always 0
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * GET SHIPMENT LIST SECTION
   * @param ctx
   * @param filter
   * @param param2
   * @returns
   */
  @Query(() => [ShipmentListPayload])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async getShipmentList(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') filters: GetShipmentInput,
    @Args() { skip, limit, sortAscending, sortField }: LoadmoreArgs,
  ): Promise<ShipmentListPayload[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const { sort = undefined }: PaginateOptions = reformPaginate({ sortField, sortAscending })
      const shipments = await ShipmentModel.aggregate(
        GET_SHIPMENT_LIST(filters, user_role, user_id, sort, skip || 0, limit || 10),
      )

      if (!shipments) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipments
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  /**
   * GET SHIPMENT LIST SECTION
   * @param ctx
   * @param param1
   * @returns
   */
  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async allshipmentIds(@Ctx() ctx: GraphQLContext, @Arg('data') filters: GetShipmentInput): Promise<string[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const shipments = await ShipmentModel.aggregate(GET_SHIPMENT_LIST(filters, user_role, user_id)).project({
        _id: 1,
      })
      const ids = map(shipments, ({ _id }) => _id)

      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง')
    }
  }

  /**
   * GET SHIPMENT LIST SECTION
   * GET TOTAL SHIPMENT FOR LIMIT CHECK
   * @param ctx
   * @param data
   * @returns
   */
  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async totalShipment(@Ctx() ctx: GraphQLContext, @Arg('data') filters: GetShipmentInput): Promise<number> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    const shipments = await ShipmentModel.aggregate(GET_SHIPMENT_LIST(filters, user_role, user_id)).project({ _id: 1 })
    return shipments.length
  }

  /**
   * GET SHIPMENT LIST SECTION
   * @param ctx
   * @param data
   * @returns
   */
  @Query(() => [TotalRecordPayload])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async countShipmentStatus(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: GetShipmentInput,
  ): Promise<TotalRecordPayload[]> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      if (user_role === EUserRole.ADMIN) {
        const customerFilter = {
          ...(data.customerId ? { customer: data.customerId } : {}),
          ...(data.driverId ? { driver: data.driverId } : {}),
        }
        const all = await ShipmentModel.countDocuments({ ...customerFilter })
        const paymentVerify = await ShipmentModel.countDocuments({
          status: EShipmentStatus.IDLE,
          adminAcceptanceStatus: EAdminAcceptanceStatus.PENDING,
          ...customerFilter,
        })
        const waitingDriver = await ShipmentModel.countDocuments({
          status: EShipmentStatus.IDLE,
          driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
          ...customerFilter,
        })
        const progressing = await ShipmentModel.countDocuments({
          status: EShipmentStatus.PROGRESSING,
          ...customerFilter,
        })
        const delivered = await ShipmentModel.countDocuments({
          status: EShipmentStatus.DELIVERED,
          ...customerFilter,
        })
        const cancelled = await ShipmentModel.countDocuments({
          status: EShipmentStatus.CANCELLED,
          ...customerFilter,
        })
        const refund = await ShipmentModel.countDocuments({ status: EShipmentStatusCriteria.REFUND, ...customerFilter })

        return [
          { label: 'ทั้งหมด', key: EShipmentStatusCriteria.ALL, count: all },
          { label: 'รอตรวจสอบการชำระ', key: EShipmentStatusCriteria.PAYMENT_VERIFY, count: paymentVerify },
          { label: 'รอคนขับตอบรับ', key: EShipmentStatusCriteria.WAITING_DRIVER, count: waitingDriver },
          { label: 'คืนเงิน', key: EShipmentStatusCriteria.REFUND, count: refund },
          { label: 'กำลังดำเนินการขนส่ง', key: EShipmentStatusCriteria.PROGRESSING, count: progressing },
          { label: 'เสร็จสิ้น', key: EShipmentStatusCriteria.DELIVERED, count: delivered },
          { label: 'ยกเลิก', key: EShipmentStatusCriteria.CANCELLED, count: cancelled },
        ]
      } else {
        const filters = { ...omit(data, 'status'), status: EShipmentStatusCriteria.ALL }
        const shipments =
          (await ShipmentModel.aggregate(GET_SHIPMENT_LIST(filters, user_role, user_id)).project({
            _id: 1,
            status: 1,
          })) || []
        console.log('countShipmentStatus: ', shipments)

        const allCount = shipments.length
        const verifyCount = shipments.filter((item) => item.status === EShipmentStatus.IDLE).length
        const progressingCount = shipments.filter((item) => item.status === EShipmentStatus.PROGRESSING).length
        const refundCount = shipments.filter((item) => item.status === EShipmentStatus.REFUND).length
        const cancelledCount = shipments.filter((item) => item.status === EShipmentStatus.CANCELLED).length
        const finishCount = shipments.filter((item) => item.status === EShipmentStatus.DELIVERED).length

        return [
          { label: 'ทั้งหมด', key: EShipmentStatusCriteria.ALL, count: allCount },
          { label: 'รอตรวจสอบการชำระ', key: EShipmentStatusCriteria.IDLE, count: verifyCount },
          { label: 'ดำเนินการ', key: EShipmentStatusCriteria.PROGRESSING, count: progressingCount },
          { label: 'คืนเงิน', key: EShipmentStatusCriteria.REFUND, count: refundCount },
          { label: 'ยกเลิก', key: EShipmentStatusCriteria.CANCELLED, count: cancelledCount },
          { label: 'เสร็จสิ้น', key: EShipmentStatusCriteria.DELIVERED, count: finishCount },
        ]
      }
    }
    return []
  }

  @Query(() => ShipmentTimeCheckPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async checkShipmentTime(
    @Arg('shipmentId') shipmentId: string,
    @Arg('newDateTime', () => Date, { nullable: true }) newDateTime: Date,
  ): Promise<ShipmentTimeCheckPayload> {
    try {
      const shipment = await ShipmentModel.findById(shipmentId).lean()
      if (!shipment || !shipment.bookingDateTime) {
        throw new GraphQLError('ไม่พบข้อมูลงานขนส่งหรือไม่ได้กำหนดเวลาเข้ารับ', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const now = new Date()
      const bookingTime = newDateTime ? newDateTime : shipment.bookingDateTime

      // คำนวณส่วนต่างเป็นนาที
      const timeDifference = differenceInMinutes(bookingTime, now)

      // ตรวจสอบเงื่อนไข
      // น้อยกว่า 120 นาที (2 ชั่วโมง)
      const isCriticalTime = timeDifference < 120
      // น้อยกว่า 180 นาที (3 ชั่วโมง) แต่ไม่ถึงขั้น Critical
      const isWarningTime = timeDifference < 180 && !isCriticalTime

      return {
        isCriticalTime,
        isWarningTime,
        timeDifferenceInMinutes: timeDifference,
      }
    } catch (error) {
      console.log(error)
      throw new GraphQLError('เกิดข้อผิดพลาดในการตรวจสอบเวลาขนส่ง')
    }
  }

  @Mutation(() => Boolean, { description: 'API สำหรับแก้ไขเวลาเริ่มงานขนส่ง' })
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN])) // อนุญาตทั้ง Admin และลูกค้า
  async updateShipmentBookingTime(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('newBookingDateTime') newBookingDateTime: Date,
  ): Promise<boolean> {
    const { session, req } = ctx
    const modifiedById = req.user_id
    if (!shipmentId) {
      throw new GraphQLError('กรุณาระบุเลขงานขนส่งที่ต้องการแก้ไข')
    }

    // ตรวจสอบว่าเวลาที่ส่งมาไม่ใช่อดีต
    if (new Date(newBookingDateTime) < new Date()) {
      throw new GraphQLError('ไม่สามารถตั้งเวลาเริ่มงานเป็นเวลาในอดีตได้')
    }

    const updatedShipment = await handleUpdateBookingTime(shipmentId, newBookingDateTime, modifiedById, session)

    await session.commitTransaction()

    if (updatedShipment.driverAcceptanceStatus !== EDriverAcceptanceStatus.ACCEPTED) {
      await shipmentNotify(shipmentId)
    }

    return true
  }

  @Query(() => PublicTrackingPayload, { description: 'ดึงข้อมูลการติดตามสถานะสำหรับบุคคลภายนอก' })
  async getPublicShipmentTracking(@Arg('trackingNumber') trackingNumber: string): Promise<PublicTrackingPayload> {
    try {
      // 1. ค้นหา Shipment จาก trackingNumber และดึงข้อมูล steps ทั้งหมดเข้ามาด้วย
      const shipment = await await ShipmentModel.findOne({ trackingNumber })
        .populate([
          {
            path: 'steps',
            populate: {
              path: 'images',
              model: 'File',
            },
          },
          {
            path: 'currentStepId',
            populate: {
              path: 'images',
              model: 'File',
            },
          },
        ])
        .lean()

      if (!shipment) {
        throw new GraphQLError('ไม่พบข้อมูลการจัดส่งสำหรับหมายเลขนี้')
      }

      const destnations = map(shipment.destinations, (_dest) => ({
        name: _dest.name,
        detail: _dest.detail,
        contactName: _dest.contactName,
        placeProvince: _dest.placeProvince,
      }))

      // 3. สร้างและคืนค่า Payload ที่มีเฉพาะข้อมูลที่จำเป็น
      return {
        status: shipment.status,
        isRoundedReturn: shipment.isRoundedReturn,
        destinations: destnations as Destination[],
        steps: shipment.steps as StepDefinition[],
        currentStep: shipment.currentStepId as StepDefinition,
      }
    } catch (error) {
      console.error(`Error fetching public tracking for ${trackingNumber}:`, error)
      if (error instanceof GraphQLError) {
        throw error
      }
      throw new Error('เกิดข้อผิดพลาดในการเรียกดูข้อมูลการจัดส่ง')
    }
  }
}
