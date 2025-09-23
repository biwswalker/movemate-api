import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { prop as Property, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import {
  DriverTransactionsAggregatePayload,
  DriverTransactionSummaryPayload,
  TransactionDriversAggregatePayload,
  TransactionPayload,
} from '@payloads/transaction.payloads'
import { endOfMonth, startOfMonth } from 'date-fns'
import { GetDriverTransactionInput, GetTransactionsArgs } from '@inputs/transactions.input'
import { DRIVER_TRANSACTIONS, GET_DRIVER_TRANSACTION_SUMMARY } from '@pipelines/transaction.pipeline'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongoose, { PaginateOptions } from 'mongoose'
import { reformPaginate } from '@utils/pagination.utils'
import { get, sum } from 'lodash'
import UserModel from './user.model'

export enum ETransactionType {
  INCOME = 'INCOME',
  OUTCOME = 'OUTCOME',
}
registerEnumType(ETransactionType, {
  name: 'ETransactionType',
  description: 'Transaction type',
})

export enum ETransactionStatus {
  COMPLETE = 'COMPLETE',
  PENDING = 'PENDING',
  CANCELED = 'CANCELED',
  OUTSTANDING = 'OUTSTANDING',
}
registerEnumType(ETransactionStatus, {
  name: 'ETransactionStatus',
  description: 'Transaction status',
})

export enum ETransactionOwner {
  MOVEMATE = 'MOVEMATE',
  DRIVER = 'DRIVER',
  BUSINESS_DRIVER = 'BUSINESS_DRIVER',
}
registerEnumType(ETransactionOwner, {
  name: 'ETransactionOwner',
  description: 'Transaction owner',
})

export enum ERefType {
  SHIPMENT = 'SHIPMENT',
  BILLING = 'BILLING',
  EARNING = 'EARNING',
}
registerEnumType(ERefType, {
  name: 'ERefType',
  description: 'Ref type',
})

/**
 * TODO: WHT Tax to calculate
 * เพิ่ม tax
 * เอา status ออก
 */

export const MOVEMATE_OWNER_ID = 'movemate-thailand'

@plugin(mongooseAggregatePaginate)
@ObjectType()
export class Transaction extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  ownerId: string

  @Field(() => ETransactionOwner)
  @Property({ required: true })
  ownerType: ETransactionOwner

  @Field()
  @Property({ required: false })
  refId: string

  @Field(() => ERefType)
  @Property({ required: false })
  refType: ERefType

  @Field(() => ETransactionType)
  @Property({ required: true })
  transactionType: ETransactionType

  @Field(() => ETransactionStatus)
  @Property({ required: true, default: ETransactionStatus.PENDING })
  status: ETransactionStatus

  @Field()
  @Property({ required: true })
  amountBeforeTax: number

  @Field()
  @Property({ required: true })
  amountTax: number

  @Field()
  @Property({ required: true })
  amount: number

  @Field()
  @Property({ required: true })
  description: string

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static aggregatePaginate: mongoose.AggregatePaginateModel<any>['aggregatePaginate']

  static async findByDriverId(driverId: string, { skip, limit }: LoadmoreArgs): Promise<Transaction[]> {
    const transactions = await TransactionModel.find({ ownerId: driverId, ownerType: ETransactionOwner.DRIVER })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec()
    return transactions
  }

  static async calculateTransaction(
    ownerId: string,
    start?: Date | undefined,
    end?: Date | undefined,
  ): Promise<TransactionPayload> {
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          ownerId,
          ...(start || end ? { createdAt: { ...(start ? { $gt: start } : {}), ...(end ? { $lt: end } : {}) } } : {}),
        },
      },
      { $group: { _id: '$transactionType', totalAmount: { $sum: '$amount' } } },
    ])
    const pendingTransactions = await TransactionModel.aggregate([
      {
        $match: {
          ownerId,
          transactionType: ETransactionType.INCOME,
          status: ETransactionStatus.PENDING,
          ...(start || end ? { createdAt: { ...(start ? { $gt: start } : {}), ...(end ? { $lt: end } : {}) } } : {}),
        },
      },
      { $group: { _id: '$transactionType', totalAmount: { $sum: '$amount' } } },
    ])
    const totalPending = pendingTransactions.length > 0 ? pendingTransactions[0]?.totalAmount : 0
    const totalIncome = transactions.find((t) => t._id === ETransactionType.INCOME)?.totalAmount || 0
    const totalOutcome = transactions.find((t) => t._id === ETransactionType.OUTCOME)?.totalAmount || 0
    const totalBalance = totalIncome - totalOutcome

    return {
      totalPending,
      totalIncome,
      totalOutcome,
      totalBalance,
    }
  }

  static async calculateMonthlyTransaction(ownerId: string, date: Date): Promise<number> {
    const startMonthDay = startOfMonth(date)
    const endMonthDay = endOfMonth(date)
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          ownerId,
          createdAt: { $gt: startMonthDay, $lt: endMonthDay },
          status: ETransactionStatus.COMPLETE,
          transactionType: ETransactionType.INCOME,
        },
      },
      { $group: { _id: '$transactionType', totalAmount: { $sum: '$amount' } } },
    ])
    const totalPending = transactions.length > 0 ? transactions[0]?.totalAmount : 0
    return totalPending
  }

  static async getTransactionDriverList(
    query: GetDriverTransactionInput,
    paginate: PaginationArgs,
  ): Promise<TransactionDriversAggregatePayload> {
    const { sort = {}, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
    const aggregatePipeline = GET_DRIVER_TRANSACTION_SUMMARY(query, sort)
    const aggregate = TransactionModel.aggregate(aggregatePipeline)
    const drivers = (await TransactionModel.aggregatePaginate(
      aggregate,
      reformSorts,
    )) as TransactionDriversAggregatePayload

    return drivers
  }

  static async getDriverTransactions(
    driverNumber: string,
    query: GetTransactionsArgs,
    paginate: PaginationArgs,
  ): Promise<DriverTransactionsAggregatePayload> {
    const { sort = {}, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
    const driver = await UserModel.findOne({ userNumber: driverNumber })
    const aggregatePipeline = DRIVER_TRANSACTIONS(driver._id.toString(), query, sort)
    const aggregate = TransactionModel.aggregate(aggregatePipeline)
    const transactions = (await TransactionModel.aggregatePaginate(
      aggregate,
      reformSorts,
    )) as DriverTransactionsAggregatePayload

    return transactions
  }

  static async driverTransactionSummary(
    ownerId: string,
    monthlyDate?: Date | undefined,
  ): Promise<DriverTransactionSummaryPayload> {
    const currentDate = new Date()
    const start = startOfMonth(monthlyDate || currentDate)
    const end = endOfMonth(monthlyDate || currentDate)

    const monthlyTransactions = await TransactionModel.aggregate([
      {
        $match: {
          ownerId,
          createdAt: { $gt: start, $lt: end },
          refType: ERefType.SHIPMENT,
          transactionType: ETransactionType.INCOME,
          amount: { $gt: 0 },
        },
      },
      { $group: { _id: '$transactionType', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])

    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          ownerId,
          refType: ERefType.SHIPMENT,
          transactionType: ETransactionType.INCOME,
          amount: { $gt: 0 },
        },
      },
      { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])

    // const allTransactions = await TransactionModel.aggregate([
    //   {
    //     $match: {
    //       ownerId,
    //       refType: ERefType.SHIPMENT,
    //       transactionType: ETransactionType.INCOME,
    //       amount: { $gt: 0 },
    //     },
    //   },
    //   { $group: { _id: '$transactionType', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    // ])

    const monthly = get(monthlyTransactions, '0', { amount: 0, count: 0 }) || { amount: 0, count: 0 }
    const pending = transactions.find(
      (t) => t._id === ETransactionStatus.PENDING || t._id === ETransactionStatus.OUTSTANDING,
    ) || { amount: 0, count: 0 }
    const paid = transactions.find((t) => t._id === ETransactionStatus.COMPLETE) || { amount: 0, count: 0 }
    // const all = get(allTransactions, '0', { amount: 0, count: 0 }) || { amount: 0, count: 0 }
    const all = { amount: sum([pending.amount, paid.amount]), count: sum([pending.count, paid.count]) }

    /**
     * Return
     * - monthly: รายได้เดือนนี้
     * - pending: รอรับเงิน
     * - paid: ได้รับเงินแล้ว
     * - all: รายได้ทั้งหมด
     */
    return {
      monthly,
      pending,
      paid,
      all,
    }
  }
}

const TransactionModel = getModelForClass(Transaction)

export default TransactionModel
