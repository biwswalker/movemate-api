import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { LoadmoreArgs } from '@inputs/query.input'
import { TransactionPayload } from '@payloads/transaction.payloads'

export enum ETransactionType {
  INCOME = 'income',
  OUTCOME = 'outcome',
}
registerEnumType(ETransactionType, {
  name: 'ETransactionType',
  description: 'Transaction type',
})

export enum ETransactionStatus {
  COMPLETE = 'complete',
  PENDING = 'pending',
}
registerEnumType(ETransactionStatus, {
  name: 'ETransactionStatus',
  description: 'Transaction status',
})

export enum ETransactionOwner {
  MOVEMATE = 'movemate',
  DRIVER = 'driver',
}
registerEnumType(ETransactionOwner, {
  name: 'ETransactionOwner',
  description: 'Transaction owner',
})

export enum ERefType {
  SHIPMENT = 'shipment',
  BILLING = 'billing',
}
registerEnumType(ERefType, {
  name: 'ERefType',
  description: 'Ref type',
})

/**
 * TODO: WHT Tax to calculate
 */

export const MOVEMATE_OWNER_ID = 'movemate-thailand'

@ObjectType()
export class Transaction extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  ownerId: string

  @Field()
  @Property({ required: true })
  ownerType: ETransactionOwner

  @Field()
  @Property({ required: false })
  refId: string

  @Field()
  @Property({ required: false })
  refType: ERefType

  @Field()
  @Property({ required: true })
  amount: number

  @Field()
  @Property({ required: true })
  transactionType: ETransactionType

  @Field()
  @Property({ required: true })
  description: string

  @Field()
  @Property({ required: true, default: ETransactionStatus.PENDING })
  status: ETransactionStatus

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static async findByDriverId(driverId: string, { skip, limit }: LoadmoreArgs): Promise<Transaction[]> {
    const transactions = await TransactionModel.find({ ownerId: driverId, ownerType: ETransactionOwner.DRIVER })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec()
    return transactions
  }

  static async calculateTransaction(ownerId: string): Promise<TransactionPayload> {
    const transactions = await TransactionModel.aggregate([
      { $match: { ownerId } },
      { $group: { _id: '$transactionType', totalAmount: { $sum: '$amount' } } },
    ])
    const pendingTransactions = await TransactionModel.aggregate([
      { $match: { ownerId, status: ETransactionStatus.PENDING } },
      { $group: { _id: '$transactionType', totalAmount: { $sum: '$amount' } } },
    ])
    const totalPending = pendingTransactions.length > 0 ? pendingTransactions[0]?.totalAmount : 0
    const totalIncome = transactions.find((t) => t._id === ETransactionType.INCOME)?.totalAmount || 0
    const totalOutcome = transactions.find((t) => t._id === ETransactionType.OUTCOME)?.totalAmount || 0
    const totalOverall = totalIncome - totalOutcome

    return {
      totalPending,
      totalIncome,
      totalOutcome,
      totalOverall,
    }
  }

  static async calculateProfit(startDate: Date, endDate: Date): Promise<TransactionPayload> {
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
          ownerType: ETransactionOwner.MOVEMATE,
          ownerId: MOVEMATE_OWNER_ID,
        },
      },
      {
        $group: {
          _id: '$transactionType',
          totalAmount: { $sum: '$amount' },
        },
      },
    ])
    const totalIncome = transactions.find((t) => t._id === ETransactionType.INCOME)?.totalAmount || 0
    const totalOutcome = transactions.find((t) => t._id === ETransactionType.OUTCOME)?.totalAmount || 0
    const totalOverall = totalIncome - totalOutcome

    return {
      totalIncome,
      totalOutcome,
      totalOverall,
    }
  }
}

const TransactionModel = getModelForClass(Transaction)

export default TransactionModel
