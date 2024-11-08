import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { GetShipmentArgs, ShipmentInput } from '@inputs/shipment.input'
import PaymentModel, { CashDetail } from '@models/payment.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import ShipmentAdditionalServicePriceModel from '@models/shipmentAdditionalServicePrice.model'
import UserModel, { User } from '@models/user.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation, FilterQuery, PaginateOptions, Types } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { filter, find, get, head, isEmpty, isEqual, last, map, omitBy, reduce, sum, tail, values } from 'lodash'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import ShipmentDistancePricingModel from '@models/shipmentDistancePricing.model'
import VehicleCostModel from '@models/vehicleCost.model'
import PrivilegeModel from '@models/privilege.model'
import DirectionsResultModel from '@models/directionResult.model'
import { FileInput } from '@inputs/file.input'
import FileModel from '@models/file.model'
import VehicleTypeModel from '@models/vehicleType.model'
import { DistanceCostPricing } from '@models/distanceCostPricing.model'
import addEmailQueue from '@utils/email.utils'
import NotificationModel, {
  ENavigationType,
  ENotificationVarient,
  NOTIFICATION_TITLE,
} from '@models/notification.model'
import {
  ShipmentPaginationAggregatePayload,
  ShipmentPaginationPayload,
  TotalRecordPayload,
} from '@payloads/shipment.payloads'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { SHIPMENT_LIST } from '@pipelines/shipment.pipeline'
import { format, parse } from 'date-fns'
import { th } from 'date-fns/locale'
import BillingCycleModel, { EBillingStatus } from '@models/billingCycle.model'
import { clearLimiter, ELimiterType } from '@configs/rateLimit'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from '@models/customerBusinessCreditPayment.model'
import { REPONSE_NAME } from 'constants/status'
import {
  cancelShipmentQueue,
  obliterateQueue,
  ShipmentPayload,
  shipmentNotifyQueue,
  ShipmentNotifyPayload,
  askCustomerShipmentQueue,
  DeleteShipmentPayload,
} from '@configs/jobQueue'
import { DoneCallback, Job } from 'bull'
import { Message } from 'firebase-admin/messaging'
import RefundModel, { ERefundStatus } from '@models/refund.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import { decryption } from '@utils/encryption'
import pubsub, { NOTFICATIONS, SHIPMENTS } from '@configs/pubsub'
import redis from '@configs/redis'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentCancellationReason,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { EDriverStatus, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'

Aigle.mixin(lodash, {})

@Resolver(Shipment)
export default class ShipmentResolver {
  @Query(() => Shipment)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async shipment(@Arg('id') id: string): Promise<Shipment> {
    try {
      const shipment = await ShipmentModel.findById(id)
      if (!shipment) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipment
    } catch (error) {
      console.log(error)
      throw error
    }
  }

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
      return shipment
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  shipmentQuery(
    {
      dateRangeStart,
      dateRangeEnd,
      trackingNumber,
      vehicleTypeId,
      status,
      startWorkingDate,
      endWorkingDate,
    }: GetShipmentArgs,
    user_role: string | undefined,
    user_id: string | undefined,
  ): FilterQuery<typeof Shipment> {
    // Status
    const statusFilterOr =
      status === EShipmentStatusCriteria.ALL
        ? [
            EShipmentStatus.IDLE,
            EShipmentStatus.PROGRESSING,
            EShipmentStatus.DELIVERED,
            EShipmentStatus.CANCELLED,
            EShipmentStatus.REFUND,
          ]
        : status === EShipmentStatusCriteria.PAYMENT_VERIFY || status === EShipmentStatusCriteria.WAITING_DRIVER
        ? [EShipmentStatus.IDLE]
        : [status]

    // Create at
    const startOfCreated = dateRangeStart ? new Date(new Date(dateRangeStart).setHours(0, 0, 0, 0)) : null
    const endOfCreated = dateRangeEnd ? new Date(new Date(dateRangeEnd).setHours(23, 59, 59, 999)) : null
    // Working
    const startOfWorking = startWorkingDate ? new Date(new Date(startWorkingDate).setHours(0, 0, 0, 0)) : null
    const endOfWorking = endWorkingDate ? new Date(new Date(endWorkingDate).setHours(23, 59, 59, 999)) : null

    // Query
    const regex = new RegExp(trackingNumber, 'i')
    const orQuery = [
      ...(trackingNumber
        ? [
            {
              trackingNumber: { $regex: regex },
              $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [],
            },
            { refId: { $regex: regex }, $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [] },
          ]
        : !isEmpty(statusFilterOr)
        ? [{ status: { $in: statusFilterOr } }]
        : []),
    ]
    const filterQuery: FilterQuery<typeof Shipment> = {
      ...(vehicleTypeId ? { vehicleId: vehicleTypeId } : {}),
      ...(startOfCreated || endOfCreated
        ? {
            createdAt: {
              ...(startOfCreated ? { $gte: startOfCreated } : {}),
              ...(endOfCreated ? { $lte: endOfCreated } : {}),
            },
          }
        : {}),
      ...(startOfWorking && endOfWorking
        ? {
            bookingDateTime: {
              ...(startOfWorking ? { $gte: startOfWorking } : {}),
              ...(endOfWorking ? { $lte: endOfWorking } : {}),
            },
          }
        : {}),
      ...(!isEmpty(orQuery) ? { $or: orQuery } : {}),
      ...(status === EShipmentStatusCriteria.PAYMENT_VERIFY
        ? { adminAcceptanceStatus: EAdminAcceptanceStatus.PENDING }
        : {}),
      ...(status === EShipmentStatusCriteria.WAITING_DRIVER
        ? { driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING }
        : {}),
      ...(user_role === EUserRole.CUSTOMER && user_id ? { customer: user_id } : {}),
    }
    return filterQuery
  }

  @Query(() => ShipmentPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async shipmentList(
    @Ctx() ctx: GraphQLContext,
    @Args()
    { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<ShipmentPaginationPayload> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const { sort = {}, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
      const filterQuery = omitBy(query, isEmpty)
      console.log(
        'raw: ',
        JSON.stringify(
          SHIPMENT_LIST(
            { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery },
            user_role,
            user_id,
            sort,
          ),
        ),
      )
      const aggregate = ShipmentModel.aggregate(
        SHIPMENT_LIST(
          { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery },
          user_role,
          user_id,
          sort,
        ),
      )
      const shipments = (await ShipmentModel.aggregatePaginate(
        aggregate,
        reformSorts,
      )) as ShipmentPaginationAggregatePayload
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

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async allshipmentIds(
    @Ctx() ctx: GraphQLContext,
    @Args() { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentArgs,
  ): Promise<string[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const filterQuery = omitBy(query, isEmpty)
      console.log(
        'raw: ',
        JSON.stringify(
          SHIPMENT_LIST(
            { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery },
            user_role,
            user_id,
          ),
        ),
      )
      const shipments = await ShipmentModel.aggregate(
        SHIPMENT_LIST(
          { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery },
          user_role,
          user_id,
        ),
      )
      const ids = map(shipments, ({ _id }) => _id)
      console.log('users: ', shipments, ids)

      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => [Shipment])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async shipments(
    @Ctx() ctx: GraphQLContext,
    @Args() args: GetShipmentArgs,
    @Args() { skip, ...paginateOpt }: LoadmoreArgs,
  ): Promise<Shipment[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      // Pagination
      console.log('----------------------', paginateOpt)
      const reformSorts = reformPaginate({ ...paginateOpt })
      const paginate = { skip, ...reformSorts }
      const filterQuery = this.shipmentQuery(args, user_role, user_id)

      console.log('---shipments---')
      console.log('paginate: ', paginate)
      console.log('filterQuery: ', filterQuery)

      const shipments = ShipmentModel.find(filterQuery, undefined, paginate)
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

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async totalShipment(@Ctx() ctx: GraphQLContext, @Args() args: GetShipmentArgs): Promise<number> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      // Query
      const filterQuery = this.shipmentQuery(args, user_role, user_id)
      const numberOfShipments = await ShipmentModel.countDocuments(filterQuery)
      return numberOfShipments
    }
    return 0
  }

  @Query(() => [TotalRecordPayload])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async statusCount(@Ctx() ctx: GraphQLContext, @Args() args: GetShipmentArgs): Promise<TotalRecordPayload[]> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      if (user_role === EUserRole.ADMIN) {
        const customerFilter = args.customerId ? { customer: args.customerId } : {}
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
        const filterQuery = (status: EShipmentStatusCriteria) =>
          this.shipmentQuery({ ...args, status }, user_role, user_id)

        const allCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.ALL))
        const progressingCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.PROGRESSING))
        const refundCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.REFUND))
        const cancelledCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.CANCELLED))
        const finishCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.DELIVERED))

        return [
          { label: 'ทั้งหมด', key: EShipmentStatusCriteria.ALL, count: allCount },
          { label: 'ดำเนินการ', key: EShipmentStatusCriteria.PROGRESSING, count: progressingCount },
          { label: 'คืนเงิน', key: EShipmentStatusCriteria.REFUND, count: refundCount },
          { label: 'ยกเลิก', key: EShipmentStatusCriteria.CANCELLED, count: cancelledCount },
          { label: 'เสร็จสิ้น', key: EShipmentStatusCriteria.DELIVERED, count: finishCount },
        ]
      }
    }
    return []
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async continueMatchingShipment(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const user_id = ctx.req.user_id
    if (user_id) {
      const shipmentModel = await ShipmentModel.findOne({ _id: shipmentId, customer: user_id })
      if (!shipmentModel) {
        const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      if (shipmentModel.status !== EShipmentStatus.IDLE) {
        const message = 'ไม่สามารถดำเนินการค้นหาพนักงานขนส่งต่อได้ เนื่องจากสถานะงานขนส่งถูกเปลี่ยนแล้ว'
        throw new GraphQLError(message, {
          extensions: { code: REPONSE_NAME.SHIPMENT_CHANGED_STATUS, errors: [{ message }] },
        })
      }

      if (shipmentModel.driverAcceptanceStatus !== EDriverAcceptanceStatus.PENDING) {
        const message = 'ไม่สามารถดำเนินการค้นหาพนักงานขนส่งต่อได้ เนื่องจากสถานะการรับงานขนส่งถูกเปลี่ยนแล้ว'
        throw new GraphQLError(message, {
          extensions: { code: REPONSE_NAME.SHIPMENT_CHANGED_STATUS, errors: [{ message }] },
        })
      }

      // TODO: Validate period of time

      const LIMIT_6 = 6
      const LIMIT_12 = 12
      const FIVEMIN = 5 * 60_000
      const TENMIN = 10 * 60_000

      const notificationCount = shipmentModel.notificationCount || 0
      const queueTimes =
        notificationCount === 0
          ? { each: TENMIN, limit: LIMIT_12 }
          : notificationCount === 1
          ? { each: FIVEMIN, limit: LIMIT_6 }
          : {}

      if (!queueTimes) {
        const message = 'ไม่สามารถดำเนินการค้นหาพนักงานขนส่งต่อได้ เนื่องจากช่วงเวลาการเตรียมงานไม่พอ'
        throw new GraphQLError(message, {
          extensions: { code: REPONSE_NAME.SHIPMENT_CHANGED_STATUS, errors: [{ message }] },
        })
      }
      await shipmentNotifyQueue.add({ shipmentId, each: queueTimes.each, limit: queueTimes.limit })
      await shipmentModel.updateOne({ notificationCount: notificationCount + 1, isNotificationPause: false })

      return true
    }
    return false
  }

  @Mutation(() => Shipment)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async createShipment(
    @Arg('data')
    {
      additionalServices,
      additionalImage,
      directionRoutes,
      discountId,
      locations,
      favoriteDriverId,
      paymentMethod,
      paymentDetail,
      cashPaymentDetail,
      ...data
    }: ShipmentInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<Shipment> {
    try {
      const user_id = ctx.req.user_id
      const customer = await UserModel.findById(user_id)
      if (!customer) {
        const message = 'ไม่สามารถหาข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const creditPaymentId = get(customer, 'businessDetail.creditPayment._id', '')
      const creditPayment = creditPaymentId ? await BusinessCustomerCreditPaymentModel.findById(creditPaymentId) : null

      const vehicle = await VehicleTypeModel.findById(data.vehicleId).lean()
      if (!vehicle) {
        const message = 'ไม่สามารถหาข้อมูลประเภทรถ เนื่องจากไม่พบประเภทรถดังกล่าว'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const isCashPaymentMethod = paymentMethod === EPaymentMethod.CASH
      const isCreditPaymentMethod = paymentMethod === EPaymentMethod.CREDIT

      // Make calculate pricing and for check credit usage
      const droppoint = locations.length - 1
      const _invoice = await ShipmentModel.calculate(
        {
          vehicleTypeId: data.vehicleId,
          distanceMeter: data.distance,
          distanceReturnMeter: data.returnDistance,
          dropPoint: droppoint,
          isRounded: data.isRoundedReturn,
          serviceIds: additionalServices,
          discountId: discountId,
          isBusinessCashPayment: customer.userType === EUserType.BUSINESS && isCashPaymentMethod,
        },
        true,
      )

      //
      const newCreditBalance = sum([creditPayment?.creditUsage || 0, _invoice.totalPrice])
      if (isCreditPaymentMethod) {
        if (newCreditBalance > creditPayment.creditLimit) {
          const message = `วงเงินของคุณไม่พอ กรุณาติดต่อเจ้าหน้าที่`
          throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.INSUFFICIENT_FUNDS, errors: [{ message }] },
          })
        }
      }

      // Favorite driver
      if (favoriteDriverId) {
        const favoriteDriver = await UserModel.findById(favoriteDriverId).lean()
        if (!favoriteDriver || favoriteDriver.userRole !== EUserRole.DRIVER) {
          const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบคนขับดังกล่าว'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        if (favoriteDriver.drivingStatus !== EDriverStatus.IDLE) {
          const message = 'พนักงานขนส่งคนโปรด กำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่'
          throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.DRIVER_CURRENTLY_WORKING, errors: [{ message }] },
          })
        }
      }

      // Duplicate additional service cost for invoice data
      const serviceBulkOperations = await Aigle.map<string, AnyBulkWriteOperation>(
        additionalServices,
        async (serviceCostId) => {
          const serviceCost = await AdditionalServiceCostPricingModel.findById(serviceCostId).lean()
          return {
            insertOne: {
              document: {
                cost: serviceCost.cost,
                price: serviceCost.price,
                reference: serviceCost._id,
              },
            },
          }
        },
      )

      const serviceBulkResult = await ShipmentAdditionalServicePriceModel.bulkWrite(serviceBulkOperations)
      const _additionalServices = values(serviceBulkResult.insertedIds)

      // Remark: Duplicate distance cost for invoice data
      const vehicleCost = await VehicleCostModel.findByVehicleId(data.vehicleId)
      const distanceBulkOperations = map<DistanceCostPricing, AnyBulkWriteOperation>(
        (vehicleCost.distance || []) as DistanceCostPricing[],
        (distanceCost) => {
          return {
            insertOne: {
              document: {
                from: distanceCost.from,
                to: distanceCost.to,
                cost: distanceCost.cost,
                price: distanceCost.price,
                benefits: distanceCost.benefits,
                unit: distanceCost.unit,
              },
            },
          }
        },
      )
      const diatanceBulkResult = await ShipmentDistancePricingModel.bulkWrite(distanceBulkOperations)
      const _distances = values(diatanceBulkResult.insertedIds)

      let _discountId = null
      if (discountId) {
        const privilege = await PrivilegeModel.findOne({ _id: discountId, usedUser: { $nin: user_id } }).lean()
        if (!privilege) {
          const message = 'ไม่สามารถหาข้อมูลส่วนลดได้ เนื่องจากไม่พบส่วนลดดังกล่าว'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        await PrivilegeModel.findByIdAndUpdate(privilege._id, { $push: { usedUser: user_id } })
        _discountId = privilege._id
      }

      // Remark: Add multiple additionals image
      const additionalImagesBulkOperations = map<FileInput, AnyBulkWriteOperation>(additionalImage, (image) => {
        return {
          insertOne: {
            document: image,
          },
        }
      })
      const additionalImagesBulkResult = await FileModel.bulkWrite(additionalImagesBulkOperations)
      const _additionalImages = values(additionalImagesBulkResult.insertedIds)

      const _directionResult = new DirectionsResultModel({
        rawData: directionRoutes,
      })
      await _directionResult.save()

      // Remark: Cash payment detail
      let cashDetail: CashDetail | null = null
      if (isCashPaymentMethod && cashPaymentDetail) {
        const { imageEvidence, ...cashDetailInput } = cashPaymentDetail
        const _imageEvidence = new FileModel(imageEvidence)
        await _imageEvidence.save()
        cashDetail = {
          ...cashDetailInput,
          imageEvidence: _imageEvidence._id,
        }
      }

      // Payment
      const _calculation = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: data.distance / 1000,
        returnedDistance: data.returnDistance / 1000,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
      })
      const _paymentNumber = await generateTrackingNumber(isCreditPaymentMethod ? 'MMPAYCE' : 'MMPAYCA', 'payment')
      const _payment = new PaymentModel({
        cashDetail,
        paymentNumber: _paymentNumber,
        creditDetail: paymentDetail,
        invoice: _invoice,
        calculation: _calculation,
        paymentMethod,
        status: isCreditPaymentMethod ? EPaymentStatus.INVOICE : EPaymentStatus.WAITING_CONFIRM_PAYMENT,
      })

      await _payment.save()

      // Create shipment id before
      const shipmentId = new Types.ObjectId()

      const status: EShipmentStatus = EShipmentStatus.IDLE
      const adminAcceptanceStatus: EAdminAcceptanceStatus = isCreditPaymentMethod
        ? EAdminAcceptanceStatus.REACH
        : EAdminAcceptanceStatus.PENDING
      const driverAcceptanceStatus: EDriverAcceptanceStatus = isCreditPaymentMethod
        ? EDriverAcceptanceStatus.PENDING
        : EDriverAcceptanceStatus.IDLE
      // Initial status log
      // const text = isCreditPaymentMethod ? favoriteDriverId ? 'รอคนขับคนโปรดรับงาน' : 'รอคนขับรับงาน' : 'รอเจ้าหน้าที่ยืนยันยอดการชำระ'
      // const startStatus: StatusLog = { status: 'pending', text, createdAt: new Date() }

      const _trackingNumber = await generateTrackingNumber('MMTH', 'tracking')
      const shipment = new ShipmentModel({
        ...data,
        _id: shipmentId,
        isRoundedReturn: data.isRoundedReturn || false,
        trackingNumber: _trackingNumber,
        customer: user_id,
        destinations: locations,
        additionalServices: _additionalServices,
        distances: _distances,
        discountId: _discountId,
        additionalImages: _additionalImages,
        directionId: _directionResult,
        payment: _payment,
        status,
        adminAcceptanceStatus,
        driverAcceptanceStatus,
        ...(favoriteDriverId ? { requestedDriver: favoriteDriverId } : {}),
        // statusLog: [startStatus]
      })
      await shipment.save()

      // Remark: Create billing cycle and billing payment
      if (isCashPaymentMethod && cashDetail) {
        const today = new Date()
        const paydate = format(cashDetail.paymentDate, 'ddMMyyyy')
        const paytime = format(cashDetail.paymentTime, 'HH:mm')
        const paymentDate = parse(`${paydate}-${paytime}`, 'ddMMyyyy-HH:mm', new Date(), { locale: th })
        const taxAmount = reduce(
          _invoice.taxs,
          (prev, curr) => {
            return sum([prev, curr.price])
          },
          0,
        )

        const _billingCycle = new BillingCycleModel({
          user: user_id,
          billingNumber: _trackingNumber, // Using tracking number instead; cause cash payment no need invoice
          issueDate: today,
          billingStartDate: today,
          billingEndDate: today,
          shipments: [shipment._id],
          subTotalAmount: _invoice.subTotalPrice,
          taxAmount,
          totalAmount: _invoice.totalPrice,
          paymentDueDate: today,
          billingStatus: EBillingStatus.VERIFY,
          paymentMethod: EPaymentMethod.CASH,
          // emailSendedTime: today
        })

        await _billingCycle.save()
        await BillingCycleModel.processPayment({
          billingCycleId: _billingCycle._id,
          paymentNumber: _payment.paymentNumber,
          paymentAmount: _invoice.totalPrice,
          paymentDate,
          imageEvidenceId: cashDetail.imageEvidence as string,
          bank: cashDetail.bank,
          bankName: cashDetail.bankName,
          bankNumber: cashDetail.bankNumber,
          userId: user_id,
        })

        // const billingCycleData = await BillingCycleModel.findById(_billingCycle._id)
        // await generateInvoice(billingCycleData)
      } else if (isCreditPaymentMethod) {
        if (!creditPayment) {
          await ShipmentModel.findByIdAndDelete(shipment._id)
          const message = 'ไม่สามารถจองรถขนส่งได้ เนื่องจากไม่พบการข้อมูลการออกใบแจ้งหนี้'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        // Update balance
        await creditPayment.updateOne({ creditUsage: newCreditBalance })
        const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
        await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
      }

      const response = await ShipmentModel.findById(shipment._id)
      await response.initialStepDefinition()

      if (isCreditPaymentMethod) {
        // Notification to Driver
        shipmentNotify(response._id, get(response, 'requestedDriver._id', ''))
      }

      // Clear redis seach limiter
      await clearLimiter(ctx.ip, ELimiterType.LOCATION, user_id || '')

      // Notification
      const notiTitle = isCashPaymentMethod ? 'การจองของท่านอยู่ระหว่างการยืนยัน' : 'การจองของท่านรอคนขับตอบรับ'
      const notiMsg = isCashPaymentMethod
        ? `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างดำเนินการยืนยันยอดชำระ`
        : `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างการตอบรับจากคนขับ`
      await NotificationModel.sendNotification({
        userId: customer._id,
        varient: ENotificationVarient.INFO,
        title: notiTitle,
        message: [notiMsg],
        infoText: 'ติดตามการขนส่ง',
        infoLink: `/main/tracking?tracking_number=${_trackingNumber}`,
      })

      // Sent email
      // Prepare email sender
      const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${response.trackingNumber}`
      const movemate_link = `https://www.movematethailand.com`
      // Email sender
      const email =
        customer.userType === EUserType.INDIVIDUAL
          ? get(customer, 'individualDetail.email', '')
          : customer.userType === EUserType.BUSINESS
          ? get(customer, 'businessDetail.businessEmail', '')
          : ''
      const fullname =
        customer.userType === EUserType.INDIVIDUAL
          ? get(customer, 'individualDetail.fullname', '')
          : customer.userType === EUserType.BUSINESS
          ? get(customer, 'businessDetail.businessName', '')
          : ''

      const originalText = head(response.destinations)?.name || ''
      const destinationsText = reduce(
        tail(response.destinations),
        (prev, curr) => {
          if (curr.name) {
            return prev ? `${prev}, ${curr.name}` : curr.name
          }
          return prev
        },
        '',
      )

      await addEmailQueue({
        from: process.env.NOREPLY_EMAIL,
        to: email,
        subject: 'Movemate Thailand ได้รับการจองรถของคุณแล้ว',
        template:
          paymentMethod === EPaymentMethod.CASH
            ? 'booking_cash_success'
            : paymentMethod === EPaymentMethod.CREDIT
            ? 'booking_credit_success'
            : '',
        context: {
          fullname,
          tracking_number: response.trackingNumber,
          original: originalText,
          destination: destinationsText,
          payment:
            paymentMethod === EPaymentMethod.CASH
              ? 'ชำระเงินสด (ผ่านการโอน)'
              : paymentMethod === EPaymentMethod.CREDIT
              ? 'ออกใบแจ้งหนี้'
              : '',
          tracking_link,
          movemate_link,
        },
      })

      const adminNotificationCount = await getAdminMenuNotificationCount()
      await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)

      return response
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  // @Mutation(() => Boolean)
  async clearMonitor(): Promise<boolean> {
    await obliterateQueue()
    return true
  }
}

export async function shipmentNotify(shipmentId: string, driverId: string) {
  const LIMIT_3 = 3
  const LIMIT_6 = 6
  const LIMIT_12 = 12 // 0 - 110 min
  const FIVEMIN = 5 * 60_000
  const TENMIN = 10 * 60_000

  if (driverId) {
    // TODO: Recheck when noti working logic
    const driver = await UserModel.findOne({
      _id: driverId,
      userRole: EUserRole.DRIVER,
      drivingStatus: EDriverStatus.IDLE,
    }).lean()
    if (driver) {
      await shipmentNotifyQueue.add({ shipmentId, driverId, each: TENMIN, limit: LIMIT_3 })
      return
    }
  }
  await shipmentNotifyQueue.add({ shipmentId, each: TENMIN, limit: LIMIT_12 })
  await ShipmentModel.findByIdAndUpdate(shipmentId, { notificationCount: 1 })
  return
}

export const cancelShipmentIfNotInterested = async (
  shipmentId: string,
  cancelMessage: string = EStepDefinitionName.UNINTERESTED_DRIVER,
  cancelReason: string = EStepDefinitionName.UNINTERESTED_DRIVER,
) => {
  const shipment = await ShipmentModel.findById(shipmentId)
  const paymentMethod = get(shipment, 'payment.paymentMethod', '')

  if (!shipment) return
  if (shipment?.driverAcceptanceStatus !== EDriverAcceptanceStatus.PENDING) return

  // Make refund if Cash
  if (isEqual(paymentMethod, EPaymentMethod.CASH)) {
    const billingCycle = await BillingCycleModel.findOne({
      shipments: { $in: [shipment._id] },
      paymentMethod: EPaymentMethod.CASH,
    }).lean()
    if (!billingCycle) {
      const message = 'พบปัญหาทางเทคนิค'
      throw new GraphQLError(message, {
        extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] },
      })
    }
    const _refund = new RefundModel({
      updatedBy: 'system',
      refundAmout: billingCycle.totalAmount,
      refundStatus: ERefundStatus.PENDING,
    })
    await _refund.save()
    await BillingCycleModel.findByIdAndUpdate(billingCycle._id, {
      billingStatus: EBillingStatus.REFUND,
      refund: _refund,
      cancelledDetail: cancelMessage,
    })

    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(shipment.steps) as StepDefinition
    if (currentStep) {
      const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
      await Aigle.forEach(deniedSteps, async (step) => {
        const isWaitDriverStep = step.step === EStepDefinition.DRIVER_ACCEPTED && step.seq === currentStep.seq
        const waitDriverStepChangeData = isWaitDriverStep
          ? {
              step: EStepDefinition.UNINTERESTED_DRIVER,
              stepName: EStepDefinitionName.UNINTERESTED_DRIVER,
              customerMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
              driverMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
            }
          : {}
        await StepDefinitionModel.findByIdAndUpdate(step._id, {
          stepStatus: EStepStatus.CANCELLED,
          ...waitDriverStepChangeData,
        })
      })
      // Add system cancelled step
      const systemCancelledSeq = lastStep.seq + 1
      const systemCancelledStep = new StepDefinitionModel({
        step: EStepDefinition.SYSTEM_CANCELLED,
        seq: systemCancelledSeq,
        stepName: EStepDefinitionName.SYSTEM_CANCELLED,
        customerMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        driverMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        stepStatus: EStepStatus.DONE,
      })
      await systemCancelledStep.save()
      // Add refund step
      const newLatestSeq = lastStep.seq + 2
      const refundStep = new StepDefinitionModel({
        step: EStepDefinition.REFUND,
        seq: newLatestSeq,
        stepName: EStepDefinitionName.REFUND,
        customerMessage: EStepDefinitionName.REFUND,
        driverMessage: EStepDefinitionName.REFUND,
        stepStatus: EStepStatus.PROGRESSING,
      })
      await refundStep.save()

      // Update Shipment
      await shipment.updateOne({
        status: EShipmentStatus.REFUND,
        driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
        cancellationReason: cancelReason,
        cancellationDetail: cancelMessage,
        cancelledDate: new Date().toISOString(),
        refund: _refund,
        currentStepSeq: newLatestSeq,
        $push: { steps: refundStep._id },
      })
    }

    await NotificationModel.sendNotification({
      userId: get(shipment, 'customer._id', ''),
      varient: ENotificationVarient.WRANING,
      title: 'การจองของท่านถูกยกเลิกอัตโนมัติ',
      message: [
        `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ระบบทำการยกเลิกอัตโนมัติเนื่องจากเลยระยะเวลาที่กำหนด และจะดำเนินการคืนให้ท่านในไม่ช้า`,
      ],
      infoText: 'ดูงานขนส่ง',
      infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
    })
  } else {
    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(shipment.steps) as StepDefinition
    if (currentStep) {
      // Update Shipment
      const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
      await Aigle.forEach(deniedSteps, async (step) => {
        const isWaitDriverStep = step.step === EStepDefinition.DRIVER_ACCEPTED && step.seq === currentStep.seq
        const waitDriverStepChangeData = isWaitDriverStep
          ? {
              step: EStepDefinition.UNINTERESTED_DRIVER,
              stepName: EStepDefinitionName.UNINTERESTED_DRIVER,
              customerMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
              driverMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
            }
          : {}
        await StepDefinitionModel.findByIdAndUpdate(step._id, {
          stepStatus: EStepStatus.CANCELLED,
          ...waitDriverStepChangeData,
        })
      })
      // Add system cancelled step
      const systemCancelledSeq = lastStep.seq + 1
      const systemCancelledStep = new StepDefinitionModel({
        step: EStepDefinition.SYSTEM_CANCELLED,
        seq: systemCancelledSeq,
        stepName: EStepDefinitionName.SYSTEM_CANCELLED,
        customerMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        driverMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        stepStatus: EStepStatus.DONE,
      })
      await systemCancelledStep.save()

      await shipment.updateOne({
        status: EShipmentStatus.CANCELLED,
        driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
        cancellationReason: cancelReason,
        cancellationDetail: cancelMessage,
        cancelledDate: new Date().toISOString(),
        currentStepSeq: systemCancelledSeq,
        $push: { steps: systemCancelledStep._id },
      })

      const totalPaid = get(shipment, 'payment.invoice.totalPrice', 0)
      const user = await UserModel.findById(shipment.customer)
      const creditDetail = get(user, 'businessDetail.creditPayment', undefined) as
        | BusinessCustomerCreditPayment
        | undefined
      if (creditDetail) {
        const newCreditBalance = creditDetail.creditUsage - totalPaid
        await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(creditDetail._id, {
          creditUsage: newCreditBalance,
        })
      }

      await NotificationModel.sendNotification({
        userId: get(shipment, 'customer._id', ''),
        varient: ENotificationVarient.WRANING,
        title: 'การจองของท่านถูกยกเลิกอัตโนมัติ',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ระบบทำการยกเลิกอัตโนมัติเนื่องจากเลยระยะเวลาที่กำหนด`,
        ],

        infoText: 'ดูงานขนส่ง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
    }
  }

  const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
  await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
  console.log(`Shipment ${shipmentId} is cancelled.`)
}

export const pauseShipmentNotify = async (shipmentId: string): Promise<boolean> => {
  const FIVTY_MIN = 15 * 60_000
  const shipment = await ShipmentModel.findById(shipmentId)
  await shipment.updateOne({ isNotificationPause: true, driver: undefined })
  await NotificationModel.sendNotification({
    varient: ENotificationVarient.WRANING,
    permanent: true,
    userId: get(shipment, 'customer._id', ''),
    title: 'การค้นหาคนขับได้หยุดชั่วคราว',
    message: [
      'ไม่มีพนักงานขนส่งรับงานหรือกำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่',
      'หากท่านจะใช้งานต่อโปรดดำเนินการในหน้า "ขนส่งของฉัน"',
    ],
    masterLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
    masterText: 'จัดการขนส่ง',
  })
  await cancelShipmentQueue.add(
    {
      shipmentId,
      type: 'idle_customer',
      message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีการกดดำเนินการในระยะเวลาที่กำหนด',
      reason: EShipmentCancellationReason.OTHER,
    },
    { delay: FIVTY_MIN },
  )

  return true
}

export const checkShipmentStatus = async (shipmentId: string): Promise<boolean> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  return shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING
}

export const sendNewShipmentNotification = async (
  shipmentId: string,
  requestDriverId: string,
): Promise<{ notify: boolean; driver: boolean }> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  if (!shipment) {
    return { notify: false, driver: false }
  }

  if (shipment?.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING) {
    const currentTime = new Date().getTime()
    const createdTime = new Date(shipment.createdAt).getTime()

    // ถ้าผ่านไป 240 นาทีแล้วยังไม่มี driver รับงาน
    const coutingdownTime = currentTime - createdTime
    const LIMITIME = 190 * 60 * 1000
    if (coutingdownTime < LIMITIME) {
      // ส่ง FCM Notification
      if (requestDriverId) {
        // TODO: Recheck when noti working logic
        const driver = await UserModel.findOne({
          _id: shipment.requestedDriver,
          userRole: EUserRole.DRIVER,
          drivingStatus: EDriverStatus.IDLE,
        })
        if (
          driver &&
          driver.status === EUserStatus.ACTIVE &&
          driver.drivingStatus === EDriverStatus.IDLE &&
          driver.validationStatus === EUserValidationStatus.APPROVE
        ) {
          if (driver.fcmToken) {
            const token = decryption(driver.fcmToken)
            const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
            const vehicleText = get(shipment, 'vehicleId.name', '')
            const pickup = head(shipment.destinations)
            const pickupText = pickup.name
            const dropoffs = tail(shipment.destinations)
            const firstDropoff = head(dropoffs)
            const dropoffsText = `${firstDropoff.name}${dropoffs.length > 1 ? `และอีก ${dropoffs.length - 1} จุด` : ''}`
            const message = `🚛 งานใหม่! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`
            await NotificationModel.sendFCMNotification({
              token,
              data: {
                navigation: ENavigationType.SHIPMENT,
                trackingNumber: shipment.trackingNumber,
              },
              notification: { title: NOTIFICATION_TITLE, body: message },
            })
            return { notify: true, driver: true }
          }
        } else {
          await shipment.updateOne({ isNotificationPause: true })
          await NotificationModel.sendNotification({
            varient: ENotificationVarient.WRANING,
            permanent: true,
            userId: get(shipment, 'customer._id', ''),
            title: 'การค้นหาคนขับได้หยุดชั่วคราว',
            message: [
              'พนักงานขนส่งคนโปรด กำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่',
              'หากท่านจะใช้งานต่อโปรดดำเนินการในหน้า "ขนส่งของฉัน"',
            ],
            masterLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
            masterText: 'จัดการขนส่ง',
          })
          await cancelShipmentQueue.add(
            {
              shipmentId,
              type: 'idle_customer',
              message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีการกดดำเนินการในระยะเวลาที่กำหนด',
              reason: EShipmentCancellationReason.OTHER,
            },
            { delay: 15 * 60_000 },
          )
          return { notify: false, driver: false }
        }
      } else {
        // Other drivers
        const drivers = await UserModel.find({ userRole: EUserRole.DRIVER, drivingStatus: EDriverStatus.IDLE })
        const messages = map<User, Message>(
          filter(drivers, ({ fcmToken }) => !isEmpty(fcmToken)),
          (driver) => {
            if (
              driver &&
              driver.fcmToken &&
              driver.status === EUserStatus.ACTIVE &&
              driver.drivingStatus === EDriverStatus.IDLE &&
              driver.validationStatus === EUserValidationStatus.APPROVE
            ) {
              const token = decryption(driver.fcmToken)
              const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
              const vehicleText = get(shipment, 'vehicleId.name', '')
              const pickup = head(shipment.destinations)
              const pickupText = pickup.name
              const dropoffs = tail(shipment.destinations)
              const firstDropoff = head(dropoffs)
              const dropoffsText = `${firstDropoff.name}${
                dropoffs.length > 1 ? ` และอีก ${dropoffs.length - 1} จุด` : ''
              }`
              const message = `🚛 งานใหม่! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`
              return {
                token,
                data: {
                  navigation: ENavigationType.SHIPMENT,
                  trackingNumber: shipment.trackingNumber,
                },
                notification: { title: NOTIFICATION_TITLE, body: message },
              }
            }
            return
          },
        )
        if (!isEmpty(messages)) {
          await NotificationModel.sendFCMNotification(messages)
        }
        return { notify: true, driver: false }
      }
    }
  }

  return { notify: false, driver: false }
}

shipmentNotifyQueue.process(async (job: Job<ShipmentNotifyPayload>, done: DoneCallback) => {
  const { shipmentId, driverId, each, limit } = job.data
  console.log('Shipment Notify queue: ', format(new Date(), 'HH:mm:ss'), job.data)
  const redisKey = `shipment:${shipmentId}`
  const newCount = await redis.incr(redisKey)
  if (newCount < limit) {
    const { notify, driver } = await sendNewShipmentNotification(shipmentId, driverId)
    if (notify) {
      await shipmentNotifyQueue.add({ shipmentId, ...(driver ? { driverId } : {}), limit, each }, { delay: each })
    } else {
      // Stop notify to customer now
      redis.set(redisKey, 0)
    }
    return done()
  } else if (newCount === limit) {
    // It Lastest trigger
    const shipmentModel = await ShipmentModel.findById(shipmentId)
    if (shipmentModel.notificationCount > 1) {
      // Cancelled this shipment
      console.log('Shipment Notify queue: Cancelled Shipment')
      await cancelShipmentQueue.add({ shipmentId }, { delay: each })
    }
    // Notifi to Customer for ask continue matching
    console.log('Shipment Notify queue: Ask Customer to Continue')
    await askCustomerShipmentQueue.add({ shipmentId }, { delay: each })
  }
  redis.set(redisKey, 0)
  return done()
})

askCustomerShipmentQueue.process(async (job: Job<ShipmentPayload>, done: DoneCallback) => {
  const { shipmentId } = job.data
  console.log('askCustomerShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
  await pauseShipmentNotify(shipmentId)
  done()
})

cancelShipmentQueue.process(async (job: Job<DeleteShipmentPayload>, done: DoneCallback) => {
  console.log('cancelShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
  const { shipmentId, type = 'uninterest', message, reason } = job.data
  if (type === 'idle_customer') {
    const shipment = await ShipmentModel.findById(shipmentId).lean()
    if (shipment.isNotificationPause) {
      await cancelShipmentIfNotInterested(shipmentId, message, reason)
    }
  } else {
    console.log('cancelShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
    await cancelShipmentIfNotInterested(shipmentId)
  }
  done()
})
