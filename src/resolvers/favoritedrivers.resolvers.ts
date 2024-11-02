import { Resolver, Ctx, UseMiddleware, Query, Mutation, Arg } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import lodash, { difference, get, includes } from 'lodash'
import { AuthGuard } from '@guards/auth.guards'
import UserModel from '@models/user.model'
import { GraphQLError } from 'graphql'
import { FavoriteDriverPayload } from '@payloads/favoriteDriver.payloads'
import Aigle from 'aigle'
import ShipmentModel from '@models/shipment.model'
import { EShipmentStatus } from '@enums/shipments'
import { EUserRole } from '@enums/users'

Aigle.mixin(lodash, {})

@Resolver()
export default class FvoariteDriverResolver {
  @Query(() => [FavoriteDriverPayload])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async getFavoriteDrivers(
    @Ctx() ctx: GraphQLContext,
    @Arg('uid', { nullable: true }) uid: string,
  ): Promise<FavoriteDriverPayload[]> {
    try {
      const userId = uid || ctx.req.user_id
      const user = await UserModel.findById(userId)
      if (!user) {
        const message = `ไม่สามารถเรียกข้อมูลของคุณได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const drivers = await user.getFavoriteDrivers()
      const driverWith = await Aigle.map(drivers, async (driver) => {
        const acceptedCount = await ShipmentModel.countDocuments({ customer: userId, driver: driver._id })
        const cancelledCount = await ShipmentModel.countDocuments({
          customer: userId,
          driver: driver._id,
          status: EShipmentStatus.CANCELLED,
        })
        return { ...get(driver, '_doc', {}), acceptedWork: acceptedCount, cancelledWork: cancelledCount }
      })
      return driverWith as FavoriteDriverPayload[]
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async makeFavoriteDriver(
    @Ctx() ctx: GraphQLContext,
    @Arg('driverId') driverId: string,
    @Arg('uid', { nullable: true }) uid: string,
  ): Promise<boolean> {
    try {
      const userId = uid || ctx.req.user_id
      const user = await UserModel.findById(userId)
      if (!user) {
        const message = `ไม่สามารถเรียกข้อมูลของคุณได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const existingDriver = includes(user.favoriteDrivers, driverId)
      if (existingDriver) {
        const message = `คนขับคนนี้เป็นคนขับคนโปรดอยู่แล้ว`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      await user.updateOne({ $push: { favoriteDrivers: driverId } })

      return true
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async removeFavoriteDriver(
    @Ctx() ctx: GraphQLContext,
    @Arg('driverId') driverId: string,
    @Arg('uid', { nullable: true }) uid: string,
  ): Promise<boolean> {
    const userId = uid || ctx.req.user_id
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        const message = `ไม่สามารถเรียกข้อมูลของคุณได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const newDriverList = difference(user.favoriteDrivers, [driverId])
      await user.updateOne({ favoriteDrivers: newDriverList })

      return true
    } catch (error) {
      throw error
    }
  }
}
