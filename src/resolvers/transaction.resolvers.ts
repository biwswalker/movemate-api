import { GraphQLContext } from '@configs/graphQL.config'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { LoadmoreArgs } from '@inputs/query.input'
import TransactionModel, { ETransactionOwner, Transaction } from '@models/transaction.model'
import { TransactionPayload } from '@payloads/transaction.payloads'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { Args, Ctx, Int, Query, Resolver, UseMiddleware } from 'type-graphql'

@Resolver(Transaction)
export default class TransactionResolver {
  @Query(() => [Transaction])
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getTransaction(
    @Ctx() ctx: GraphQLContext,
    @Args() { skip, limit, ...loadmore }: LoadmoreArgs,
  ): Promise<Transaction[]> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const transactions = await TransactionModel.find({ ownerId: userId, ownerType: ETransactionOwner.DRIVER })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 })
      .exec()

    return transactions
  }

  @Query(() => TransactionPayload)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async calculateTransaction(@Ctx() ctx: GraphQLContext): Promise<TransactionPayload> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const transactions = await TransactionModel.calculateTransaction(userId)

    return transactions
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async totalTransaction(@Ctx() ctx: GraphQLContext): Promise<number> {
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const count = await TransactionModel.countDocuments({ ownerId: userId, ownerType: ETransactionOwner.DRIVER })
    return count
  }
}
