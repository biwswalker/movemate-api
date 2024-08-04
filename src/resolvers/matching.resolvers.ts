import { Resolver, Ctx, Args, Query, UseMiddleware, Arg, Int } from 'type-graphql'
import { LoadmoreArgs } from '@inputs/query.input'
import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel from '@models/user.model'
import { get } from 'lodash'
import { IndividualDriver } from '@models/driverIndividual.model'
import { GraphQLError } from 'graphql'
import { FilterQuery, Types } from 'mongoose'
import { Ref } from '@typegoose/typegoose'
import { VehicleType } from '@models/vehicleType.model'

type TShipmentStatus = 'new' | 'progressing' | 'dilivered' | 'cancelled'

@Resolver()
export default class MatchingResolver {

  generateQueery(status: TShipmentStatus, userId: string, vehicleId: Ref<VehicleType>) {
    const statusQuery: FilterQuery<Shipment> = status === 'new'
      ? {
        status: 'idle',
        driverAcceptanceStatus: 'pending',
        vehicleId,
        $or: [
          { requestedDriver: { $exists: false } },    // ไม่มี requestedDriver
          { requestedDriver: null },                  // requestedDriver เป็น null
          { requestedDriver: userId },                // requestedDriver ตรงกับ userId
          { requestedDriver: { $ne: userId } }        // requestedDriver ไม่ตรงกับ userId
        ]
      }
      : status === 'progressing' // Status progressing
        ? {
          status: 'progressing',
          driverAcceptanceStatus: 'accepted',
          driver: new Types.ObjectId(userId)
        }
        : status === 'cancelled' // Status cancelled
          ? {
            driverAcceptanceStatus: 'accepted',
            driver: new Types.ObjectId(userId),
            $or: [
              { status: 'cancelled' },
              { status: 'refund' },
            ]
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

  @Query(() => [Shipment])
  @UseMiddleware(AuthGuard(["driver"]))
  async getAvailableShipment(@Ctx() ctx: GraphQLContext, @Arg("status") status: TShipmentStatus, @Args() { skip, limit, ...loadmore }: LoadmoreArgs): Promise<Shipment[]> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = "ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน";
      throw new GraphQLError(message, { extensions: { code: "NOT_FOUND", errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('individualDriver').lean()
    const individualDriver = get(user, 'individualDriver', undefined) as IndividualDriver | undefined

    if (!individualDriver) {
      const message = "ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน";
      throw new GraphQLError(message, { extensions: { code: "NOT_FOUND", errors: [{ message }] } })
    }

    const query = this.generateQueery(status, userId, individualDriver.serviceVehicleType)

    const shipments = await ShipmentModel.find(query).skip(skip).limit(limit).sort({ createdAt: 1 }).exec()
    return shipments;
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard(["driver"]))
  async totalAvailableShipment(@Ctx() ctx: GraphQLContext, @Arg("status") status: TShipmentStatus): Promise<number> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = "ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน";
      throw new GraphQLError(message, { extensions: { code: "NOT_FOUND", errors: [{ message }] } })
    }

    const user = await UserModel.findById(userId).populate('individualDriver').lean()
    const individualDriver = get(user, 'individualDriver', undefined) as IndividualDriver | undefined

    if (!individualDriver) {
      const message = "ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน";
      throw new GraphQLError(message, { extensions: { code: "NOT_FOUND", errors: [{ message }] } })
    }

    const query = this.generateQueery(status, userId, individualDriver.serviceVehicleType)

    const shipmentCount = await ShipmentModel.countDocuments(query)
    return shipmentCount
  }
}