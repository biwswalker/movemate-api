import { Resolver, Ctx, UseMiddleware, Query, Mutation, Arg } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import lodash, { difference, get, includes } from 'lodash'
import { AuthGuard } from '@guards/auth.guards'
import UserModel from '@models/user.model'
import { GraphQLError } from 'graphql'
import { FavoriteDriverPayload } from '@payloads/favoriteDriver.payloads'
import Aigle from 'aigle'
import ShipmentModel, { EShipingStatus } from '@models/shipment.model'

Aigle.mixin(lodash, {})

@Resolver()
export default class FvoariteDriverResolver {
  @Query(() => [FavoriteDriverPayload])
  @UseMiddleware(AuthGuard(['customer']))
  async getFavoriteDrivers(@Ctx() ctx: GraphQLContext): Promise<FavoriteDriverPayload[]> {
    try {
      const userId = ctx.req.user_id
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
          status: EShipingStatus.CANCELLED,
        })
        return { ...get(driver, '_doc', {}), acceptedWork: acceptedCount, cancelledWork: cancelledCount }
      })
      console.log('driverWith', driverWith)
      return driverWith as FavoriteDriverPayload[]
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['customer']))
  async makeFavoriteDriver(@Ctx() ctx: GraphQLContext, @Arg('driverId') driverId: string): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
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
  @UseMiddleware(AuthGuard(['customer']))
  async removeFavoriteDriver(@Ctx() ctx: GraphQLContext, @Arg('driverId') driverId: string): Promise<boolean> {
    const userId = ctx.req.user_id
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
