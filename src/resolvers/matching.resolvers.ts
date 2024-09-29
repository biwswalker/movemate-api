import { Resolver, Ctx, Args, Query, UseMiddleware, Arg, Int, Mutation, Subscription, Root } from 'type-graphql'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel, { EDriverStatus } from '@models/user.model'
import { get, isEqual } from 'lodash'
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
import { removeMonitorShipmentJob } from '@configs/jobQueue'
import { addDays } from 'date-fns'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { Repeater } from '@graphql-yoga/subscription'

// Custom status for driver
type TShipmentStatus = 'new' | 'progressing' | 'dilivered' | 'cancelled'

@Resolver()
export default class MatchingResolver {
  generateQuery(status: TShipmentStatus, userId: string, vehicleId: Ref<VehicleType>) {
    const currentDate = new Date()
    const threeDayAfter = addDays(currentDate, 3)
    const statusQuery: FilterQuery<Shipment> =
      status === 'new'
        ? {
            status: 'idle',
            driverAcceptanceStatus: 'pending',
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
        : status === 'progressing' // Status progressing
        ? {
            status: 'progressing',
            driverAcceptanceStatus: 'accepted',
            driver: new Types.ObjectId(userId),
          }
        : status === 'cancelled' // Status cancelled
        ? {
            driverAcceptanceStatus: 'accepted',
            driver: new Types.ObjectId(userId),
            $or: [{ status: 'cancelled' }, { status: 'refund' }],
          }
        : status === 'dilivered' // Status complete
        ? {
            status: 'dilivered',
            driverAcceptanceStatus: 'accepted',
            driver: new Types.ObjectId(userId),
          }
        : { _id: 'none' } // Not Included status

    return statusQuery
  }

  @Subscription(() => [Shipment], {
    topics: SHIPMENTS.GET_MATCHING_SHIPMENT,
    subscribe: async ({ context }) => {
      console.log('ListenAvailableShipment Subscribe: ', context)
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
    @Arg('status') status: TShipmentStatus,
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
    const shipments = await ShipmentModel.find(query).skip(skip).limit(limit).sort({ createdAt: 1 }).exec()

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
  async totalAvailableShipment(@Ctx() ctx: GraphQLContext, @Arg('status') status: TShipmentStatus): Promise<number> {
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
    if (shipment.status === 'idle' && shipment.driverAcceptanceStatus === 'pending') {
      await shipment.nextStep()
      await ShipmentModel.findByIdAndUpdate(shipmentId, {
        status: 'progressing',
        driverAcceptanceStatus: 'accepted',
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

      await removeMonitorShipmentJob(shipment._id)

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
