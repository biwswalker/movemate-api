import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { GetShipmentInput, ShipmentInput } from '@inputs/shipment.input'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { find, isEmpty, map, omitBy, sum } from 'lodash'
import {
  ShipmentPaginationAggregatePayload,
  ShipmentPaginationPayload,
  TotalRecordPayload,
} from '@payloads/shipment.payloads'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { SHIPMENT_LIST } from '@pipelines/shipment.pipeline'
import { clearLimiter, ELimiterType } from '@configs/rateLimit'
import { REPONSE_NAME } from 'constants/status'
import { shipmentNotifyQueue } from '@configs/jobQueue'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { EPaymentMethod } from '@enums/payments'
import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { EUserRole } from '@enums/users'
import { CalculationInput } from '@inputs/booking.input'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'
import { createShipment, updateShipment } from '@controllers/shipment'
import { calculateQuotation, calculateStep } from '@controllers/quotation'
import { CalculateQuotationResultPayload } from '@payloads/quotation.payloads'
import { shipmentNotify } from '@controllers/shipmentNotification'
import { getNewAllAvailableShipmentForDriver } from '@controllers/shipmentGet'
import { VALUES } from 'constants/values'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import AdditionalServiceModel from '@models/additionalService.model'
import { EServiceStatus } from '@enums/additionalService'
import { PricingCalculationMethodPayload } from '@payloads/pricing.payloads'

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
    }: GetShipmentInput,
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
    @Arg('data')
    { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentInput,
    @Args() paginate: PaginationArgs,
  ): Promise<ShipmentPaginationPayload> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const { sort = {}, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
      const filterQuery = omitBy(query, isEmpty)
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
    @Arg('data') { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentInput,
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
    @Arg('data') data: GetShipmentInput,
    @Args() { skip, ...paginateOpt }: LoadmoreArgs,
  ): Promise<Shipment[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      // Pagination
      console.log('----------------------', paginateOpt)
      const reformSorts = reformPaginate({ ...paginateOpt })
      const paginate = { skip, ...reformSorts }
      const filterQuery = this.shipmentQuery(data, user_role, user_id)

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
  async totalShipment(@Ctx() ctx: GraphQLContext, @Arg('data') data: GetShipmentInput): Promise<number> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      // Query
      const filterQuery = this.shipmentQuery(data, user_role, user_id)
      const numberOfShipments = await ShipmentModel.countDocuments(filterQuery)
      return numberOfShipments
    }
    return 0
  }

  @Query(() => [TotalRecordPayload])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async statusCount(@Ctx() ctx: GraphQLContext, @Arg('data') data: GetShipmentInput): Promise<TotalRecordPayload[]> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      if (user_role === EUserRole.ADMIN) {
        const customerFilter = data.customerId ? { customer: data.customerId } : {}
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
          this.shipmentQuery({ ...data, status }, user_role, user_id)

        const allCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.ALL))
        const verifyCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.PAYMENT_VERIFY))
        const progressingCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.PROGRESSING))
        const refundCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.REFUND))
        const cancelledCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.CANCELLED))
        const finishCount = await ShipmentModel.countDocuments(filterQuery(EShipmentStatusCriteria.DELIVERED))

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
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]), RetryTransactionMiddleware)
  async createShipment(@Arg('data') data: ShipmentInput, @Ctx() ctx: GraphQLContext): Promise<Shipment> {
    const session = ctx.session
    const customerId = ctx.req.user_id

    const shipmentResponse = await createShipment(data, customerId, session)
    if (shipmentResponse) {
      const shipment = await ShipmentModel.findById(shipmentResponse._id).session(session).lean()
      if (shipment.paymentMethod === EPaymentMethod.CREDIT) {
        const newShipments = await getNewAllAvailableShipmentForDriver()
        await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
        shipmentNotify(shipment._id, shipment.requestedDriver ? shipment.requestedDriver.toString() || '' : '')
      }
      await clearLimiter(ctx.ip, ELimiterType.LOCATION, customerId)
    }
    return shipmentResponse
  }

  @Mutation(() => CalculateQuotationResultPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async calculateExistingShipment(@Arg('data') data: CalculationInput): Promise<CalculateQuotationResultPayload> {
    try {
      const pricing = await calculateQuotation(data, '')
      return pricing
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async updateShipment(@Arg('data') data: CalculationInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
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
}
