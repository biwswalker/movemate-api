import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { LoadmoreArgs } from '@inputs/query.input'

export enum ETransactionType {
  INCOME = 'income',
  OUTCOME = 'outcome',
}

export enum ETransactionStatus {
  PAID = 'paid',
  PENDING = 'pending',
}

@ObjectType()
export class Transaction extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  driverId: string

  @Field()
  @Property({ required: false })
  shipmentId: string

  @Field()
  @Property({ required: false })
  trackingNumber: string

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

  static async findByUserId(driverId: string, { skip, limit }: LoadmoreArgs): Promise<Transaction[]> {
    const transactions = await TransactionModel.find({ driverId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec()
    return transactions
  }
}

const TransactionModel = getModelForClass(Transaction)

export default TransactionModel
