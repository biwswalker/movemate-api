import { GraphQLContext } from '@configs/graphQL.config'
import { cancelledShipment, driverCancelledShipment } from '@controllers/shipmentOperation'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { WithTransaction } from '@middlewares/RetryTransaction'
import { Arg, Ctx, Mutation, Resolver, UseMiddleware } from 'type-graphql'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'

@Resolver()
export default class CancellationResolver {
  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async makeCancellation(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('reason') reason: string,
  ): Promise<boolean> {
    const session = ctx.session
    const actionUserId = ctx.req.user_id
    // Handle Refund
    await cancelledShipment({ shipmentId, reason }, actionUserId, session)

    // Sent admin noti count updates
    const adminNotificationCount = await getAdminMenuNotificationCount(session)
    await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async driverCalcellation(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('reason') reason: string,
  ): Promise<boolean> {
    const session = ctx.session
    // Handle make new Matching
    await driverCancelledShipment({ shipmentId, reason }, session)

    // Sent admin noti count updates
    const adminNotificationCount = await getAdminMenuNotificationCount(session)
    await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
    return true
  }
}
