import { GraphQLContext } from '@configs/graphQL.config'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { WithTransaction } from '@middlewares/RetryTransaction'
import { Arg, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { GraphQLError } from 'graphql'
import { cancelledShipment, driverCancelledShipment } from '@controllers/shipmentCancellation'
import { shipmentNotify } from '@controllers/shipmentNotification'
import { clearShipmentJobQueues } from '@controllers/shipmentJobQueue'
import { CancellationPreview } from '@payloads/cancellation.payload'
import { getShipmentCancellationPreview } from '@controllers/shipmentOperation'

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
    await clearShipmentJobQueues(shipmentId)
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
    const user_id = ctx.req.user_id
    if (!shipmentId) {
      throw new GraphQLError('ไม่พบงานขนส่ง')
    }
    // Handle make new Matching
    await driverCancelledShipment({ shipmentId, reason }, user_id, session)

    if (session) {
      await session.commitTransaction()
    }
    await shipmentNotify(shipmentId)
    return true
  }

  @Query(() => CancellationPreview)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async getShipmentCancellationPreview(@Arg('shipmentId') shipmentId: string): Promise<CancellationPreview> {
    if (!shipmentId) {
      throw new GraphQLError('กรุณาระบุเลขงานขนส่ง')
    }
    const previewData = await getShipmentCancellationPreview(shipmentId)
    return previewData
  }
}
