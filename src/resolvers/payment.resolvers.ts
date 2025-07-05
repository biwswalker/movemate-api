import { Resolver, Arg, Ctx, UseMiddleware, Mutation, Float } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { EQRPaymentType } from '@enums/payments'
import { EUserRole } from '@enums/users'
import { generate } from 'promptparse'
import { REPONSE_NAME } from 'constants/status'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'
import { MakePayBillingInput } from '@inputs/payment.input'
import { makePayBilling } from '@controllers/billingPayment'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'

@Resolver()
export default class PaymentResolver {
  /**
   * [WIP]
   * @param amount
   * @param data
   * @param ctx
   * @returns
   */
  @Mutation(() => String)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async generateQRPaymentCodes(
    @Arg('amount', () => Float) amount: number,
    @Arg('type', () => EQRPaymentType, { nullable: true })
    data: EQRPaymentType = EQRPaymentType.BANK_ACCOUNT,
    @Ctx() ctx: GraphQLContext,
  ): Promise<string> {
    try {
      if (amount > 0) {
        const code = generate.anyId({
          type: data,
          target: '',
          amount,
        })
        return code
      }
      const message = 'ไม่สามารถสร้างข้อมูลชำระได้ เนื่องจากยอดชำระไม่ถูกต้อง'
      throw new GraphQLError(message, {
        extensions: {
          code: REPONSE_NAME.INSUFFICIENT_FUNDS,
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]), RetryTransactionMiddleware)
  async makeAdditionalPayment(
    @Arg('billingId') billingId: string,
    @Arg('paymentId') paymentId: string,
    @Arg('data', () => MakePayBillingInput) data: MakePayBillingInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const session = ctx.session

    await makePayBilling(data, billingId, paymentId, session)

    // Sent admin noti count updates
    await getAdminMenuNotificationCount(session)
    return true
  }
}
