import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import BillingCycleModel from '@models/billingCycle.model'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { Arg, Ctx, Mutation, Resolver, UseMiddleware } from 'type-graphql'

@Resolver()
export default class CancellationResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['customer']))
  async makeCancellation(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('reason') reason: string,
    @Arg('reasonDetail') reasonDetail: string,
  ): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    // Handle Refund
    await BillingCycleModel.customerRefund(shipmentId, userId, reason, reasonDetail)

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['customer']))
  async driverCalcellation(
    @Ctx() ctx: GraphQLContext,
    @Arg('shipmentId') shipmentId: string,
    @Arg('reason') reason: string,
    @Arg('reasonDetail') reasonDetail: string,
  ): Promise<boolean> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    // Handle Refund
    await BillingCycleModel.driverCancelled(shipmentId, userId, reason, reasonDetail)

    return true
  }
}
