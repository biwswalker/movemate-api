import { Resolver, Mutation, UseMiddleware, Ctx, Args } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { ApprovalCashPaymentArgs } from '@inputs/billingPayment.input'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import lodash from 'lodash'
import Aigle from 'aigle'
import BillingCycleModel from '@models/billingCycle.model'
import BillingPaymentModel from '@models/billingPayment.model'

Aigle.mixin(lodash, {});

@Resolver()
export default class BillingPaymentResolver {

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async approvalCashPayment(@Ctx() ctx: GraphQLContext, @Args() args: ApprovalCashPaymentArgs): Promise<boolean> {
    const user_id = ctx.req.user_id
    const billingCycleModel = await BillingCycleModel.findById(args.billingCycleId).lean()
    const billingPaymentModel = await BillingPaymentModel.findById(billingCycleModel.billingPayment).lean()
    if (!billingCycleModel || !billingPaymentModel) {
      const message = "ไม่สามารถหาข้อมูลการชำระได้ เนื่องจากไม่พบการชำระดังกล่าว";
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (args.result === 'approve') {
      await BillingCycleModel.markAsPaid(billingCycleModel._id, user_id)
      return true
    } else if (args.result === 'reject') {
      await BillingCycleModel.rejectedPayment(billingCycleModel._id, user_id, args.reason, args.otherReason)
      return true
    }
    return false
  }
}
