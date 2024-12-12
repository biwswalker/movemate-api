import { GraphQLContext } from '@configs/graphQL.config'
import { ETransactionDriverStatus } from '@enums/transactions'
import { EUserRole, EUserType } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import { GetDriverTransactionArgs, GetTransactionsArgs } from '@inputs/transactions.input'
import DriverPaymentModel, { DriverPayment } from '@models/driverPayment.model'
import ShipmentModel from '@models/shipment.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  Transaction,
} from '@models/transaction.model'
import UserModel from '@models/user.model'
import {
  TransactionDriversAggregatePayload,
  DriverTransactionsAggregatePayload,
  TransactionPayload,
  TransactionDriversTotalRecordPayload,
  PreparationTransactionPayload,
  DriverTransactionSummaryPayload,
  TransactionDetailPayload,
} from '@payloads/transaction.payloads'
import { DRIVER_TRANSACTIONS, TRANSACTION_DRIVER_LIST } from '@pipelines/transaction.pipeline'
import { reformPaginate } from '@utils/pagination.utils'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { isEmpty, map, reduce, sum } from 'lodash'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Float, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'

@Resolver(Transaction)
export default class TransactionResolver {
  @Query(() => [Transaction])
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getTransaction(
    @Ctx() ctx: GraphQLContext,
    @Args() { skip, limit, ...loadmore }: LoadmoreArgs,
  ): Promise<Transaction[]> {
    const { sort = {} }: PaginateOptions = reformPaginate(loadmore)
    const userId = ctx.req.user_id
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const transactions = await TransactionModel.find(
      {
        ownerId: userId,
        ownerType: { $in: [ETransactionOwner.DRIVER, ETransactionOwner.BUSINESS_DRIVER] },
      },
      undefined,
      { sort },
    )
      .skip(skip)
      .limit(limit)
      .exec()

    return transactions
  }

  @Query(() => DriverTransactionSummaryPayload)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async calculateTransaction(@Ctx() ctx: GraphQLContext): Promise<DriverTransactionSummaryPayload> {
    const userId = ctx.req.user_id
    const summaries = await TransactionModel.driverTransactionSummary(userId)
    return summaries
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

  @Query(() => TransactionDriversAggregatePayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getTransactionDrivers(
    @Args() queries: GetDriverTransactionArgs,
    @Args() paginates: PaginationArgs,
  ): Promise<TransactionDriversAggregatePayload> {
    const drivers = await TransactionModel.getTransactionDriverList(queries, paginates)
    return drivers
  }

  @Query(() => [TransactionDriversTotalRecordPayload])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getTransactionDriversCounting(): Promise<TransactionDriversTotalRecordPayload[]> {
    const pendingPayment = await TransactionModel.aggregate(TRANSACTION_DRIVER_LIST({ isPending: true }))
    const nonPayment = await TransactionModel.aggregate(TRANSACTION_DRIVER_LIST({ isPending: false }))
    const allPayment = await TransactionModel.aggregate(TRANSACTION_DRIVER_LIST({ isPending: undefined }))
    return [
      { label: 'มียอดทำจ่าย', count: pendingPayment.length, key: ETransactionDriverStatus.PENDING },
      { label: 'ไม่มียอด', count: nonPayment.length, key: ETransactionDriverStatus.NON_OUTSTANDING },
      { label: 'ทั้งหมด', count: allPayment.length, key: ETransactionDriverStatus.ALL },
    ]
  }

  @Query(() => DriverTransactionsAggregatePayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverTransactions(
    @Arg('driverNumber') driverNumber: string,
    @Args() queries: GetTransactionsArgs,
    @Args() paginates: PaginationArgs,
  ): Promise<DriverTransactionsAggregatePayload> {
    const transactions = await TransactionModel.getDriverTransactions(driverNumber, queries, paginates)
    return transactions
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverTransactionsIds(
    @Arg('driverNumber') driverNumber: string,
    @Args() queries: GetTransactionsArgs,
  ): Promise<string[]> {
    const driver = await UserModel.findOne({ userNumber: driverNumber })
    const transactions = await TransactionModel.aggregate(DRIVER_TRANSACTIONS(driver._id.toString(), queries, {}))
    const ids = map(transactions, ({ _id }) => _id)
    return ids
  }

  @Mutation(() => PreparationTransactionPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPreparationPaymentByTransactions(
    @Arg('driverNumber') driverNumber: string,
    @Arg('transactionIds', () => [String]) transactionIds: string[],
  ): Promise<PreparationTransactionPayload> {
    const user = await UserModel.findOne({ userNumber: driverNumber })
    const isBusinessDriver = user.userType === EUserType.BUSINESS
    const transactions = await TransactionModel.find({ _id: { $in: transactionIds } })
    const completedTransaction = transactions.filter(({ status }) => status === ETransactionStatus.COMPLETE)
    if (!isEmpty(completedTransaction)) {
      const message = 'ไม่สามารถใช้ข้อมูลรายการชำระนี้ได้ กรุณารีโหลดรายการใหม่'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const subTotal = reduce(
      transactions,
      (prev, transaction) => {
        const amounts = sum([prev, transaction.amount])
        return amounts
      },
      0,
    )
    const taxPercent = subTotal > 1000 ? (isBusinessDriver ? 0.01 : 0) : 0
    const taxIncluded = subTotal * taxPercent
    const total = sum([subTotal, -taxIncluded])
    return {
      subtotal: subTotal,
      tax: taxIncluded,
      total,
      transactions: transactions,
    }
  }

  @Query(() => DriverTransactionSummaryPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverTransactionSummary(
    @Arg('driverNumber') driverNumber: string,
    @Arg('monthDate', { nullable: true }) monthDate: Date,
  ): Promise<DriverTransactionSummaryPayload> {
    const driver = await UserModel.findOne({ userNumber: driverNumber })
    const summaries = await TransactionModel.driverTransactionSummary(driver._id.toString(), monthDate)
    return summaries
  }

  @Query(() => TransactionDetailPayload)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getDriverTransactionDetail(
    @Ctx() ctx: GraphQLContext,
    @Arg('transactionId') transactionId: string,
  ): Promise<TransactionDetailPayload> {
    const transaction = await TransactionModel.findById(transactionId)
    if (transaction) {
      if (transaction.refType === ERefType.SHIPMENT) {
        const shipment = await ShipmentModel.findById(transaction.refId)
        return {
          transaction,
          shipment,
        }
      } else if (transaction.refType === ERefType.EARNING) {
        const driverPayment = await DriverPaymentModel.findById(transaction.refId)
        return {
          transaction,
          driverPayment,
        }
      }
    }

    const message = 'ไม่สามารถเรียกข้อมูลการเงินได้ กรุณาลองใหม่'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
}
