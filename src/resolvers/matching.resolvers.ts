import { Resolver, Ctx, Args, Query, UseMiddleware, Arg, Int, Mutation, Subscription, Root } from 'type-graphql'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel, { EDriverStatus, EUserType } from '@models/user.model'
import { get, head, isEqual, reduce, tail, uniq } from 'lodash'
import IndividualDriverModel, { IndividualDriver } from '@models/driverIndividual.model'
import { GraphQLError } from 'graphql'
import { FilterQuery, Types } from 'mongoose'
import { Ref } from '@typegoose/typegoose'
import { VehicleType } from '@models/vehicleType.model'
import { REPONSE_NAME } from 'constants/status'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import {
  ConfirmShipmentDateInput,
  NextShipmentStepInput,
  SentPODDocumentShipmentStepInput,
} from '@inputs/matching.input'
import { addDays, format } from 'date-fns'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { Repeater } from '@graphql-yoga/subscription'
import BillingCycleModel from '@models/billingCycle.model'
import addEmailQueue from '@utils/email.utils'
import { EPaymentMethod } from '@enums/payments'
import { EDriverAcceptanceStatus, EShipmentMatchingCriteria, EShipmentStatus } from '@enums/shipments'

@Resolver()
export default class MatchingResolver {
  generateQuery(status: EShipmentMatchingCriteria, userId: string, vehicleId: Ref<VehicleType>) {
    const currentDate = new Date()
    const threeDayAfter = addDays(currentDate, 3)
    const statusQuery: FilterQuery<Shipment> =
      status === EShipmentMatchingCriteria.NEW
        ? {
            status: EShipmentStatus.IDLE,
            driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
            vehicleId,
            $or: [
              { requestedDriver: { $exists: false } }, // ไม่มี requestedDriver
              { requestedDriver: null }, // requestedDriver เป็น null
              { requestedDriver: userId }, // requestedDriver ตรงกับ userId
              { requestedDriver: { $ne: userId } }, // requestedDriver ไม่ตรงกับ userId
            ],
            $nor: [
              {
                driver: new Types.ObjectId(userId), // คนขับคนเดิม
                // bookingDateTime: {
                //   $exists: true,
                //   $ne: null,
                //   // งานใหม่ห้ามทับซ้อนกับเวลางานเก่าที่ driver ทำอยู่ + 3 วัน
                //   $gte: currentDate, // งานใหม่ต้องเกิดขึ้นหลังจากปัจจุบัน
                //   $lte: threeDayAfter, // เวลาจบของงานเก่าต้องไม่น้อยกว่า 3 วันนับจากเวลาที่ทำงาน
                // },
              },
            ],
          }
        : status === EShipmentMatchingCriteria.PROGRESSING // Status progressing
        ? {
            status: EShipmentMatchingCriteria.PROGRESSING,
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            driver: new Types.ObjectId(userId),
          }
        : status === EShipmentMatchingCriteria.CANCELLED // Status cancelled
        ? {
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            driver: new Types.ObjectId(userId),
            $or: [{ status: EShipmentMatchingCriteria.CANCELLED }, { status: 'refund' }],
          }
        : status === EShipmentMatchingCriteria.DELIVERED // Status complete
        ? {
            status: EShipmentMatchingCriteria.DELIVERED,
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            driver: new Types.ObjectId(userId),
          }
        : { _id: 'none' } // Not Included status

    return statusQuery
  }

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
    const user = await UserModel.findById(ctx.user_id).lean()
    if (user?.drivingStatus !== EDriverStatus.IDLE) return []
    const individualDriver = await IndividualDriverModel.findById(user.individualDriver).lean()
    const userPayload = payload.filter((item) => {
      const vehicleId = get(item, 'vehicleId._id', '')
      const isMatchedService = isEqual(vehicleId, individualDriver.serviceVehicleType)
      console.log('isMatchedService: ', isMatchedService, vehicleId, individualDriver.serviceVehicleType)
      return isMatchedService
    })
    return userPayload
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
  @UseMiddleware(AuthGuard(['driver']))
  async getAvailableShipment(
    @Ctx() ctx: GraphQLContext,
    @Arg('status') status: EShipmentMatchingCriteria,
    @Args() { skip, limit, ...loadmore }: LoadmoreArgs,
  ): Promise<Shipment[]> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('individualDriver').lean()
    const individualDriver = get(user, 'individualDriver', undefined) as IndividualDriver | undefined

    if (!individualDriver) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const query = this.generateQuery(status, userId, individualDriver.serviceVehicleType)

    console.log('-----getAvailableShipment query-----', JSON.stringify(query))
    const shipments = await ShipmentModel.find(query).skip(skip).limit(limit).sort({ bookingDateTime: -1 }).exec()

    return shipments
  }

  @Query(() => Shipment)
  @UseMiddleware(AuthGuard(['driver']))
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
  @UseMiddleware(AuthGuard(['driver']))
  async totalAvailableShipment(@Ctx() ctx: GraphQLContext, @Arg('status') status: EShipmentMatchingCriteria): Promise<number> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('individualDriver').lean()
    const individualDriver = get(user, 'individualDriver', undefined) as IndividualDriver | undefined

    if (!individualDriver) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const query = this.generateQuery(status, userId, individualDriver.serviceVehicleType)

    const shipmentCount = await ShipmentModel.countDocuments(query)
    return shipmentCount
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['driver']))
  async acceptShipment(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<boolean> {
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
    // Check shipment are available
    if (
      shipment.status === EShipmentStatus.IDLE &&
      shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING
    ) {
      await shipment.nextStep()
      await ShipmentModel.findByIdAndUpdate(shipmentId, {
        status: EShipmentStatus.PROGRESSING,
        driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
        driver: userId,
      })
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

      // await removeMonitorShipmentJob(shipment._id)

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
  @UseMiddleware(AuthGuard(['driver']))
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
  @UseMiddleware(AuthGuard(['driver']))
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
  @UseMiddleware(AuthGuard(['driver']))
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
  @UseMiddleware(AuthGuard(['driver']))
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
                customer_type: customerModel.userType === 'individual' ? 'ส่วนบุคคล' : 'บริษัท/องค์กร',
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
  @UseMiddleware(AuthGuard(['driver']))
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
}
