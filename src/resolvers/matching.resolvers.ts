import { Resolver, Ctx, Args, Query, UseMiddleware, Arg, Int, Mutation, Subscription, Root } from 'type-graphql'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel, { User } from '@models/user.model'
import { filter, find, get, head, includes, isEmpty, last, map, sortBy, tail } from 'lodash'
import DriverDetailModel, { DriverDetail } from '@models/driverDetail.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import NotificationModel, { ENavigationType, ENotificationVarient } from '@models/notification.model'
import {
  ConfirmShipmentDateInput,
  NextShipmentStepInput,
  SentPODDocumentShipmentStepInput,
} from '@inputs/matching.input'
import { addSeconds, format, isBefore, parseISO } from 'date-fns'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { Repeater } from '@graphql-yoga/subscription'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EDriverAcceptanceStatus, EQuotationStatus, EShipmentMatchingCriteria, EShipmentStatus } from '@enums/shipments'
import { EDriverStatus, EUserRole, EUserStatus, EUserType } from '@enums/users'
import { th } from 'date-fns/locale'
import { FilterQuery } from 'mongoose'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import RetryTransactionMiddleware, { WithTransaction } from '@middlewares/RetryTransaction'
import { generateMonthlySequenceNumber } from '@utils/string.utils'
import {
  getAcceptedShipmentForDriverQuery,
  getNewAllAvailableShipmentForDriver,
  getNewAllAvailableShipmentForDriverQuery,
  publishDriverMatchingShipment,
} from '@controllers/shipmentGet'
import { addStep, finishJob, nextStep, podSent } from '@controllers/shipmentOperation'
import BillingModel from '@models/finance/billing.model'
import ReceiptModel, { Receipt } from '@models/finance/receipt.model'
import _ from 'mongoose-paginate-v2'
import { generateBillingReceipt } from '@controllers/billingReceipt'
import { AuditLogDecorator } from 'decorators/AuditLog.decorator'
import { EAuditActions } from '@enums/audit'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import { clearShipmentJobQueues } from '@controllers/shipmentJobQueue'
import { EReceiptType } from '@enums/billing'
import { Payment } from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'

@Resolver()
export default class MatchingResolver {
  @Subscription(() => [Shipment], {
    topics: SHIPMENTS.GET_MATCHING_SHIPMENT,
    subscribe: async ({ context }) => {
      const repeater = new Repeater(async (push, stop) => {
        try {
          const shipments = await getNewAllAvailableShipmentForDriver(context?.user_id)
          push(shipments)
          await stop
        } catch (error) {
          console.log('ListenAvailableShipment error: ', error)
        }
      })
      return Repeater.merge([repeater, pubsub.subscribe(SHIPMENTS.GET_MATCHING_SHIPMENT)])
    },
  } as any)
  async listenAvailableShipment(@Root() payload: Shipment[], @Ctx() ctx: AuthContext): Promise<Shipment[]> {
    console.log('ListenAvailableShipment:', ctx.user_id)
    try {
      const user = await UserModel.findById(ctx.user_id).lean()

      if (user) {
        const isBusinessDriver = user.userType === EUserType.BUSINESS
        if (isBusinessDriver) {
          const childrens = await UserModel.find({ parents: { $in: [ctx.user_id] } }).lean()
          if (isEmpty(childrens)) {
            return []
          }
        }
        if (user?.drivingStatus === EDriverStatus.BUSY) return []
        let ignoreShipmets = []
        if (!isBusinessDriver) {
          const existingShipments = await ShipmentModel.find({
            agentDriver: user._id,
            status: EShipmentStatus.PROGRESSING,
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
          }).lean()
          const ignoreTimeRange = map(existingShipments, (shipment) => {
            const start = shipment.bookingDateTime
            const end = addSeconds(shipment.bookingDateTime, shipment.displayTime)
            return { bookingDateTime: { $gte: start, $lt: end } }
          })
          if (!isEmpty(ignoreTimeRange)) {
            ignoreShipmets = await ShipmentModel.find({ $or: ignoreTimeRange }).lean()
          }
        }

        const driverDetail = await DriverDetailModel.findById(user.driverDetail).lean()

        const userPayload = payload.filter((item) => {
          console.log(item.trackingNumber, item.status)
          const isIgnoreShipment = find(ignoreShipmets, ['_id', item._id])
          if (isIgnoreShipment) {
            return false
          }
          const vehicleId = get(item, 'vehicleId._id', '')
          const normalizeVehicleTypes = map(driverDetail.serviceVehicleTypes, (type) => type.toString())
          const isMatchedService = includes(normalizeVehicleTypes, vehicleId.toString())
          return isMatchedService
        })
        return userPayload
      }
      return []
    } catch (error) {
      console.log('error: ', error)
    }
  }

  /**
   * Remove this
   * @returns
   */
  @Query(() => Boolean)
  async trigNewAvailableShipment(): Promise<boolean> {
    const shipments = await getNewAllAvailableShipmentForDriver()
    pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, shipments)
    return true
  }

  @Query(() => [Shipment])
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getAvailableShipment(
    @Ctx() ctx: GraphQLContext,
    @Arg('status', () => EShipmentMatchingCriteria) status: EShipmentMatchingCriteria,
    @Args() { skip, limit, ...loadmore }: LoadmoreArgs,
  ): Promise<Shipment[]> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('driverDetail').lean()
    const driverDetail = get(user, 'driverDetail', undefined) as DriverDetail | undefined

    if (!driverDetail) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (status && status !== EShipmentMatchingCriteria.NEW) {
      const query = await getAcceptedShipmentForDriverQuery(status, userId)
      console.log('shipment query: ', query)

      const shipments = await ShipmentModel.find(query, undefined, { skip, limit })
      return shipments
    }
    const shipments = await getNewAllAvailableShipmentForDriver(userId, { skip, limit })
    return shipments
  }

  @Query(() => Shipment, { nullable: true })
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getActiveShipment(@Ctx() ctx: GraphQLContext): Promise<Shipment> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('driverDetail').lean()
    const driverDetail = get(user, 'driverDetail', undefined) as DriverDetail | undefined

    if (!driverDetail) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const shipmentDriver = user.userType === EUserType.BUSINESS ? { agent: userId } : { driver: userId }

    const query: FilterQuery<Shipment> = { ...shipmentDriver, status: EShipmentStatus.PROGRESSING }

    const shipment = await ShipmentModel.findOne(query, undefined, { sort: { bookingDateTime: 1 } })

    return shipment
  }

  @Query(() => Shipment)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getAvailableShipmentByTrackingNumber(
    @Ctx() ctx: GraphQLContext,
    @Arg('tracking') trackingNumber: string,
  ): Promise<Shipment> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findOne({ trackingNumber: trackingNumber })
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    return shipment
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async totalAvailableShipment(
    @Ctx() ctx: GraphQLContext,
    @Arg('status', () => EShipmentMatchingCriteria) status: EShipmentMatchingCriteria,
  ): Promise<number> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('driverDetail').lean()
    const driverDetail = get(user, 'driverDetail', undefined) as DriverDetail | undefined

    if (!driverDetail) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (status && status !== EShipmentMatchingCriteria.NEW) {
      const query = await getAcceptedShipmentForDriverQuery(status, userId)
      const shipmentCount = await ShipmentModel.countDocuments(query)
      return shipmentCount
    }
    const query = await getNewAllAvailableShipmentForDriverQuery(undefined, userId)
    const shipmentCount = await ShipmentModel.countDocuments(query)
    return shipmentCount
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  @UseMiddleware(
    AuditLogDecorator({
      action: EAuditActions.ACCEPT_SHIPMENT,
      entityType: 'Shipment',
      entityId: (root, args) => args.shipmentId,
      details: (root, args, context) => ({ driverId: context.req.user_id }),
    }),
  )
  async acceptShipment(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const user = await UserModel.findById(userId).session(session).lean()
    if (!user) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId).session(session)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    // Check shipment are available
    if (
      shipment.status === EShipmentStatus.IDLE &&
      shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING
    ) {
      const isBusinessUser = user.userType === EUserType.BUSINESS
      await ShipmentModel.findByIdAndUpdate(
        shipmentId,
        {
          status: EShipmentStatus.PROGRESSING,
          driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
          ...(isBusinessUser ? { agentDriver: userId } : { driver: userId }),
        },
        { session },
      )

      if (isBusinessUser) {
        /**
         * Trigger add waiting assign driver step
         */
        const currentShipmentStep = shipment.currentStepId as StepDefinition
        const nextSeq = currentShipmentStep.seq + 1
        const assignShipmentStep = new StepDefinitionModel({
          step: EStepDefinition.ASSIGN_SHIPMENT,
          seq: nextSeq,
          stepName: EStepDefinitionName.ASSIGN_SHIPMENT,
          customerMessage: EStepDefinitionName.ASSIGN_SHIPMENT,
          driverMessage: 'บริษัทมอบหมายงานให้พนักงาน',
          stepStatus: EStepStatus.IDLE,
        })
        await addStep(shipmentId, assignShipmentStep, nextSeq, session)
      }

      /**
       * Trigger next step
       */
      const freshShipment = await ShipmentModel.findById(shipmentId)
      await nextStep(shipmentId, undefined, session)
      if (!isBusinessUser) {
        // await UserModel.findByIdAndUpdate(userId, { drivingStatus: EDriverStatus.WORKING }, { session })
        // Notification
        const customerId = get(freshShipment, 'customer._id', '')
        if (customerId) {
          await NotificationModel.sendNotification(
            {
              userId: customerId,
              varient: ENotificationVarient.MASTER,
              title: `${freshShipment.trackingNumber} คนขับตอบรับแล้ว`,
              message: [
                `งานขนส่งเลขที่ ${freshShipment.trackingNumber} ได้รับการตอบรับจากคนขับแล้ว คนขับจะติดต่อหาท่านเพื่อนัดหมาย`,
              ],
            },
            session,
          )
        }
      }

      // Clear Shipment Notification queue
      await clearShipmentJobQueues(shipmentId)

      // Update shipment list in Driver app
      await publishDriverMatchingShipment(undefined, undefined, session)

      // Sent admin notifcation count updates
      await getAdminMenuNotificationCount(session)

      return true
    }
    const message = 'ไม่สามารถรับงานขนส่งนี้ได้ เนื่องจากงานขนส่งดังกล่าวมีผู้รับไปแล้ว'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.EXISTING_SHIPMENT_DRIVER, errors: [{ message }] },
    })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER, EUserRole.ADMIN]), RetryTransactionMiddleware)
  async confirmShipmentDatetime(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: ConfirmShipmentDateInput,
  ): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(data.shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    await nextStep(shipment._id, undefined, session)
    await shipment.updateOne(
      {
        bookingDateTime: data.datetime,
        isBookingWithDate: true,
      },
      { session },
    )

    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.DRIVER, EUserRole.ADMIN]))
  async nextShipmentStep(@Ctx() ctx: GraphQLContext, @Arg('data') data: NextShipmentStepInput): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(data.shipmentId).session(session)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    await nextStep(shipment._id, data.images || [], session)

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER, EUserRole.ADMIN]), RetryTransactionMiddleware)
  async sentPODDocument(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: SentPODDocumentShipmentStepInput,
  ): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(data.shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (!data.trackingNumber) {
      const message = 'ไม่สามารถบันทึกได้ เนื่องจากต้องระบุหมายเลขติดตาม'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (!data.provider) {
      const message = 'ไม่สามารถบันทึกได้ เนื่องจากต้องระบุบริษัทขนส่ง'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    await podSent(shipment._id, data.images || [], data.trackingNumber, data.provider, session)

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER, EUserRole.ADMIN]), RetryTransactionMiddleware)
  async markAsFinish(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const session = ctx.session

    const shipment = await ShipmentModel.findById(shipmentId).session(session)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    await finishJob(shipment._id, session)

    const paymentMethod = shipment.paymentMethod

    if (paymentMethod === EPaymentMethod.CASH) {
      const _billing = await BillingModel.findOne({ billingNumber: shipment.trackingNumber }).session(session)
      if (_billing) {
        const _payments = sortBy((_billing.payments || []) as Payment[], 'createdAt').filter(_payment => !includes([EPaymentStatus.CANCELLED], _payment.status))
        const isWaitingPaidOrApproval = _payments.some((_payment) => _payment.status === EPaymentStatus.PENDING && _payment.type !== EPaymentType.REFUND)
        if (isWaitingPaidOrApproval) {
          const message = 'ไม่สามารถดำเนินการสำเร็จได้ เนื่องลูกค้ายังไม่ได้ชำระเงิน'
          throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.INSUFFICIENT_FUNDS, errors: [{ message }] },
          })
        }

        const _advanceReceipts = filter(_billing.receipts, { receiptType: EReceiptType.ADVANCE })
        const _advanceReceipt = last(sortBy(_advanceReceipts, 'createdAt')) as Receipt | undefined
        const today = new Date()

        const _paymentQoutations = _payments.filter((_payment) => !isEmpty(_payment.quotations))
        const lastPayment = last(_paymentQoutations)
        const _quotation = last(sortBy(lastPayment.quotations as Quotation[], 'createdAt').filter((_quotation) => includes([EQuotationStatus.ACTIVE], _quotation.status))) as Quotation | undefined

        // if (_quotation?.price?.acturePrice !== _quotation?.price?.total && !(_advanceReceipts.length > 1)) {
        //   const _priceDifference = _quotation.price.acturePrice
        //   if (_priceDifference > 0) {
        //     const _tax = _quotation.price.tax > 0 ? _priceDifference * (1 / (100 - 1)) : 0
        //     const _newSubTotal = _priceDifference + _tax

        //     // Not using this any more after changed price have remark
        //     remarks = `เพิ่มค่าใช้จ่าย ${fCurrency(Math.abs(_newSubTotal))} บาท เนื่องจากเปลี่ยนแปลงการใช้บริการ`
        //   } else if (_priceDifference < 0) {
        //     // const _tax = _quotation.price.tax > 0 ? _priceDifference * (1 / (100 - 1)) : 0
        //     // const _newSubTotal = _priceDifference + _tax

        //     // Not using this any more after changed price have remark
        //     remarks = `คืนเงินลูกค้า ${fCurrency(Math.abs(_priceDifference))} บาท เนื่องจากเปลี่ยนแปลงการใช้บริการ`
        //   }
        // }

        const _receiptNumber = await generateMonthlySequenceNumber('receipt')

        const _receipt = new ReceiptModel({
          receiptNumber: _receiptNumber,
          receiptType: EReceiptType.FINAL,
          receiptDate: today,
          document: null,
          subTotal: _quotation.subTotal,
          total: _quotation.total,
          tax: _quotation.tax,
          refReceiptNumber: _advanceReceipt?.receiptNumber,
          remarks: _quotation.remark || '',
        })
        await _receipt.save({ session })

        await BillingModel.findByIdAndUpdate(_billing._id, { $push: { receipts: _receipt._id } }, { session })

        /**
         * generate receipt
         */
        const documentId = await generateBillingReceipt(_billing._id, true, session)
        await ReceiptModel.findByIdAndUpdate(_receipt._id, { document: documentId }, { session })
      }
    }

    await UserModel.findByIdAndUpdate(shipment.driver, { drivingStatus: EDriverStatus.IDLE }, { session })

    // Sent admin noti count updates
    await getAdminMenuNotificationCount(session)
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async markAsCancelled(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId).session(session)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    // await shipment.cancelledJobByDriver()
    await UserModel.findByIdAndUpdate(userId, { drivingStatus: EDriverStatus.IDLE }, { session })

    // Sent admin noti count updates
    await getAdminMenuNotificationCount(session)
    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async assignShipment(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('driverId') driverId: string,
    @Arg('isChanged', { nullable: true }) isChanged: boolean,
  ): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const user = await UserModel.findById(userId).session(session).lean()
    if (!user) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId).session(session)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const driver = await UserModel.findById(driverId).session(session).lean()
    if (!driver) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (driver.status !== EUserStatus.ACTIVE || driver.driverDetail === EDriverStatus.BUSY) {
      const message = 'คนขับไม่อยู่ในสถานะที่จะรับงานได้'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (
      // !shipment.driver &&
      shipment.status === EShipmentStatus.PROGRESSING &&
      shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.ACCEPTED
    ) {
      const isBusinessUser = user.userType === EUserType.BUSINESS
      if (isBusinessUser) {
        if (shipment.driver) {
          if (isChanged) {
            const now = new Date()
            const bookingTime = new Date(shipment.bookingDateTime)

            if (!isBefore(now, bookingTime)) {
              throw new GraphQLError('ไม่สามารถเปลี่ยนคนขับได้ เนื่องจากเกินเวลาเริ่มงานแล้ว')
            }

            // 2. ตรวจสอบเงื่อนไขด้านขั้นตอน: ต้องอยู่ก่อน step 'confirm_datetime'
            const confirmStep = find(shipment.steps as StepDefinition[], { step: EStepDefinition.CONFIRM_DATETIME })
            if (!confirmStep) {
              throw new GraphQLError('ไม่พบขั้นตอนยืนยันวันเวลาในระบบ')
            }

            const isCannotChangeDriver = includes([EStepStatus.DONE, EStepStatus.CANCELLED], confirmStep.stepStatus)
            if (isCannotChangeDriver) {
              throw new GraphQLError('ไม่สามารถเปลี่ยนคนขับได้ เนื่องจากเกินเวลาเริ่มงานแล้ว')
            }

            const oldDriver = shipment.driver as User
            await ShipmentModel.findByIdAndUpdate(shipmentId, { driver: driverId }, { session })
            // await UserModel.findOneAndUpdate(
            //   { _id: oldDriver._id, drivingStatus: { $in: [EDriverStatus.IDLE, EDriverStatus.WORKING] } },
            //   { drivingStatus: EDriverStatus.IDLE },
            //   { session },
            // )

            if (oldDriver) {
              // Sent app Notiification to Driver
              await NotificationModel.sendNotification(
                {
                  userId: oldDriver._id,
                  varient: ENotificationVarient.MASTER,
                  title: `งานขนส่งหมายเลข ${shipment.trackingNumber} มีการเปลี่ยนแปลงคนขับ`,
                  message: [
                    `🔔 นายหน้า ${user.fullname} ได้เปลี่ยนคนขับของงานหมายเลข ${shipment.trackingNumber} โปรดตรวจสอบข้อมูลใหม่`,
                  ],
                },
                session,
                true,
                { navigation: ENavigationType.SHIPMENT, trackingNumber: shipment.trackingNumber },
              )
            }
            const customerId = get(shipment, 'customer._id', '')
            if (customerId) {
              await NotificationModel.sendNotification(
                {
                  userId: customerId,
                  varient: ENotificationVarient.MASTER,
                  title: `งานขนส่งหมายเลข ${shipment.trackingNumber} มีการเปลี่ยนแปลงคนขับ`,
                  message: [
                    `งานขนส่งหมายเลข ${shipment.trackingNumber} มีการเปลี่ยนแปลงคนขับ คนขับจะติดต่อหาท่านเพื่อนัดหมาย`,
                  ],
                },
                session,
              )
            }
          } else {
            const message = 'ไม่สามารถรับงานขนส่งนี้ได้ เนื่องจากงานขนส่งดังกล่าวมีผู้รับไปแล้ว'
            throw new GraphQLError(message, {
              extensions: { code: REPONSE_NAME.EXISTING_SHIPMENT_DRIVER, errors: [{ message }] },
            })
          }
        } else {
          await ShipmentModel.findByIdAndUpdate(shipmentId, { driver: driverId }, { session })
          await nextStep(shipment._id, undefined, session)
          const customerId = get(shipment, 'customer._id', '')
          if (customerId) {
            await NotificationModel.sendNotification({
              userId: customerId,
              varient: ENotificationVarient.MASTER,
              title: `${shipment.trackingNumber} คนขับตอบรับแล้ว`,
              message: [
                `งานขนส่งเลขที่ ${shipment.trackingNumber} ได้รับการตอบรับจากคนขับแล้ว คนขับจะติดต่อหาท่านเพื่อนัดหมาย`,
              ],
            })
          }
        }

        if (driver) {
          const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
          const vehicleText = get(shipment, 'vehicleId.name', '')
          const pickup = head(shipment.destinations)
          const pickupText = pickup.name
          const dropoffs = tail(shipment.destinations)
          const firstDropoff = head(dropoffs)
          const dropoffsText = `${firstDropoff.name}${dropoffs.length > 1 ? `และอีก ${dropoffs.length - 1} จุด` : ''}`
          // Sent app Notiification to Driver
          const message = `🔔 งานใหม่จากนายหน้า! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`
          await NotificationModel.sendNotification(
            {
              userId: driver._id,
              varient: ENotificationVarient.MASTER,
              title: `งานใหม่จากนายหน้า ${user.fullname} งานขนส่งเลขที่ ${shipment.trackingNumber}`,
              message: [message],
            },
            session,
            true,
            { navigation: ENavigationType.SHIPMENT, trackingNumber: shipment.trackingNumber },
          )
        }
      }

      // Shipment socket
      await publishDriverMatchingShipment(undefined, undefined, session)
      // Sent admin noti count updates
      await getAdminMenuNotificationCount(session)
      return true
    }
    const message = 'ไม่สามารถรับงานขนส่งนี้ได้ เนื่องจากงานขนส่งดังกล่าวมีผู้รับไปแล้ว'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.EXISTING_SHIPMENT_DRIVER, errors: [{ message }] },
    })
  }
}
