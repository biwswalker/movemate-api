import { Resolver, Ctx, Args, Query, UseMiddleware, Arg, Int, Mutation, Subscription, Root } from 'type-graphql'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel from '@models/user.model'
import { find, get, head, includes, isEmpty, map, reduce, tail, uniq } from 'lodash'
import DriverDetailModel, { DriverDetail } from '@models/driverDetail.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import {
  ConfirmShipmentDateInput,
  NextShipmentStepInput,
  SentPODDocumentShipmentStepInput,
} from '@inputs/matching.input'
import { addSeconds, format } from 'date-fns'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { Repeater } from '@graphql-yoga/subscription'
import BillingCycleModel from '@models/billingCycle.model'
import addEmailQueue from '@utils/email.utils'
import { EPaymentMethod } from '@enums/payments'
import { EDriverAcceptanceStatus, EShipmentMatchingCriteria, EShipmentStatus } from '@enums/shipments'
import { EDriverStatus, EUserRole, EUserStatus, EUserType } from '@enums/users'

@Resolver()
export default class MatchingResolver {
  @Subscription(() => [Shipment], {
    topics: SHIPMENTS.GET_MATCHING_SHIPMENT,
    subscribe: async ({ context }) => {
      console.log('ListenAvailableShipment Subscribe: ')
      const repeater = new Repeater(async (push, stop) => {
        const shipments = await ShipmentModel.getNewAllAvailableShipmentForDriver(context.user_id)
        push(shipments)
        await stop
      })
      return Repeater.merge([repeater, pubsub.subscribe(SHIPMENTS.GET_MATCHING_SHIPMENT)])
    },
    filter: async ({ payload, args, context }) => {
      console.log('ListenAvailableShipment Filter: ')
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
          const isIgnoreShipment = find(ignoreShipmets, ['_id', item._id])
          if (isIgnoreShipment) {
            return false
          }
          const vehicleId = get(item, 'vehicleId._id', '')
          const normalizeVehicleTypes = map(driverDetail.serviceVehicleTypes, (type) => type.toString())
          const isMatchedService = includes(normalizeVehicleTypes, vehicleId.toString())
          console.log('isMatchedService: ', isMatchedService, vehicleId, normalizeVehicleTypes)
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
    const shipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
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
      const query = await ShipmentModel.getAcceptedShipmentForDriverQuery(status, userId)
      const shipments = await ShipmentModel.find(query, undefined, { skip, limit })
      return shipments
    }

    const shipments = await ShipmentModel.getNewAllAvailableShipmentForDriver(userId, { skip, limit })
    return shipments
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
      const query = await ShipmentModel.getAcceptedShipmentForDriverQuery(status, userId)
      const shipmentCount = await ShipmentModel.countDocuments(query)
      return shipmentCount
    }
    const query = await ShipmentModel.getNewAllAvailableShipmentForDriverQuery(userId)
    const shipmentCount = await ShipmentModel.countDocuments(query)
    return shipmentCount
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async acceptShipment(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId)
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
      await ShipmentModel.findByIdAndUpdate(shipmentId, {
        status: EShipmentStatus.PROGRESSING,
        driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
        ...(isBusinessUser ? { agentDriver: userId } : { driver: userId }),
      })
      if (!isBusinessUser) {
        await shipment.nextStep()
        await UserModel.findByIdAndUpdate(userId, { drivingStatus: EDriverStatus.WORKING })
        // Notification
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

      const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
      await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)

      return true
    }
    const message = 'ไม่สามารถรับงานขนส่งนี้ได้ เนื่องจากงานขนส่งดังกล่าวมีผู้รับไปแล้ว'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.EXISTING_SHIPMENT_DRIVER, errors: [{ message }] },
    })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async confirmShipmentDatetime(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: ConfirmShipmentDateInput,
  ): Promise<boolean> {
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

    await shipment.nextStep()
    await shipment.updateOne({
      bookingDateTime: data.datetime,
      isBookingWithDate: true,
    })

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async nextShipmentStep(@Ctx() ctx: GraphQLContext, @Arg('data') data: NextShipmentStepInput): Promise<boolean> {
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

    await shipment.nextStep(data.images || [])

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async sentPODDocument(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: SentPODDocumentShipmentStepInput,
  ): Promise<boolean> {
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
    await shipment.podSent(data.images || [], data.trackingNumber, data.provider)

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async markAsFinish(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    await shipment.finishJob()

    const paymentMethod = get(shipment, 'payment.paymentMethod', '')
    const customer = await UserModel.findById(shipment.customer)
    if (paymentMethod === EPaymentMethod.CASH) {
      if (customer.userType === EUserType.BUSINESS) {
        const billingCycle = await BillingCycleModel.findOne({ shipments: { $in: [shipmentId] } }).lean()
        if (billingCycle.taxAmount > 0) {
          // Sent email
          const customerModel = await UserModel.findById(billingCycle.user)
          if (shipment && customerModel) {
            const financialEmails = get(customerModel, 'businessDetail.creditPayment.financialContactEmails', [])
            const emails = uniq([customerModel.email, ...financialEmails])

            const pickup = head(shipment.destinations)?.name || ''
            const dropoffs = reduce(
              tail(shipment.destinations),
              (prev, curr) => {
                if (curr.name) {
                  return prev ? `${prev}, ${curr.name}` : curr.name
                }
                return prev
              },
              '',
            )
            const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${shipment.trackingNumber}`
            await addEmailQueue({
              from: process.env.NOREPLY_EMAIL,
              to: emails,
              subject: `ขอบคุณที่ใช้บริการ Movemate Thailand | Shipment No. ${shipment.trackingNumber}`,
              template: 'cash_wht_receipt',
              context: {
                tracking_number: shipment.trackingNumber,
                fullname: customerModel.fullname,
                phone_number: customerModel.contactNumber,
                email: customerModel.email,
                customer_type: customerModel.userType === EUserType.INDIVIDUAL ? 'ส่วนบุคคล' : 'บริษัท/องค์กร',
                pickup,
                dropoffs,
                tracking_link,
                contact_number: '02-xxx-xxxx',
                movemate_link: `https://www.movematethailand.com`,
              },
            })
            console.log(
              `[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`,
            )
          }
        } else {
          await BillingCycleModel.generateShipmentReceipt(shipmentId, true)
        }
      } else {
        await BillingCycleModel.generateShipmentReceipt(shipmentId, true)
      }
    }
    await UserModel.findByIdAndUpdate(userId, { drivingStatus: EDriverStatus.IDLE })
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async markAsCancelled(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    // await shipment.cancelledJobByDriver()
    await UserModel.findByIdAndUpdate(userId, { drivingStatus: EDriverStatus.IDLE })
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async assignShipment(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('driverId') driverId: string,
  ): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const shipment = await ShipmentModel.findById(shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถเรียกข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const driver = await UserModel.findById(driverId).lean()
    if (!driver) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (driver.status !== EUserStatus.ACTIVE || driver.driverDetail === EDriverStatus.BUSY) {
      const message = 'คนขับไม่อยู่ในสถานะที่จะรับงานได้'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (
      !shipment.driver &&
      shipment.status === EShipmentStatus.PROGRESSING &&
      shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.ACCEPTED
    ) {
      const isBusinessUser = user.userType === EUserType.BUSINESS
      if (isBusinessUser) {
        await ShipmentModel.findByIdAndUpdate(shipmentId, { driver: driverId })
        await shipment.nextStep()
        await UserModel.findByIdAndUpdate(driverId, { drivingStatus: EDriverStatus.WORKING })
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
      const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
      await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)

      return true
    }
    const message = 'ไม่สามารถรับงานขนส่งนี้ได้ เนื่องจากงานขนส่งดังกล่าวมีผู้รับไปแล้ว'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.EXISTING_SHIPMENT_DRIVER, errors: [{ message }] },
    })
  }
}
