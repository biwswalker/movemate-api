import { EUserType } from '@enums/users'
import { User } from '@models/user.model'
import { Field, Float, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { Shipment } from '@models/shipment.model'
import { ETransactionStatus, ETransactionType, Transaction } from '@models/transaction.model'
import { ETransactionDriverStatus } from '@enums/transactions'
import { DriverPayment } from '@models/driverPayment.model'

@ObjectType()
export class TransactionPayload {
  @Field(() => Float, { defaultValue: 0, nullable: true })
  totalPending?: number

  @Field(() => Float)
  totalIncome: number

  @Field(() => Float)
  totalOutcome: number

  @Field(() => Float)
  totalBalance: number
}

@ObjectType()
export class TransactionDrivesPayload {
  @Field(() => Float, { defaultValue: 0 })
  pendingAmount: number

  @Field(() => User, { nullable: true })
  driver: User

  @Field(() => EUserType, { nullable: true })
  driverType: EUserType

  @Field(() => Date, { nullable: true })
  lastestPaid: Date
}

@ObjectType()
export class TransactionDriversAggregatePayload
  extends PaginationPayload
  implements AggregatePaginateResult<TransactionDrivesPayload>
{
  @Field(() => [TransactionDrivesPayload])
  docs: TransactionDrivesPayload[]
}

@ObjectType()
export class TransactionDriversTotalRecordPayload {
  @Field()
  label: string

  @Field(() => ETransactionDriverStatus)
  key: ETransactionDriverStatus

  @Field(() => Int)
  count: number
}

@ObjectType()
export class DriverTransactionsPayload {
  @Field()
  _id: string

  @Field(() => Shipment, { nullable: true })
  shipment: Shipment

  @Field(() => DriverPayment, { nullable: true })
  driverPayment: DriverPayment

  @Field(() => Float)
  amount: number

  @Field(() => ETransactionType)
  transactionType: ETransactionType

  @Field()
  description: string

  @Field(() => ETransactionStatus)
  status: ETransactionStatus

  @Field(() => Date)
  createdAt: Date

  @Field(() => Date)
  updatedAt: Date
}

@ObjectType()
export class DriverTransactionsAggregatePayload
  extends PaginationPayload
  implements AggregatePaginateResult<DriverTransactionsPayload>
{
  @Field(() => [DriverTransactionsPayload])
  docs: DriverTransactionsPayload[]
}

@ObjectType()
export class PreparationTransactionPayload {
  @Field(() => Float)
  subtotal: number

  @Field(() => Float)
  tax: number

  @Field(() => Float)
  total: number

  @Field(() => [Transaction])
  transactions: Transaction[]
}

@ObjectType()
class TransactionSummaryPayload {
  @Field(() => Float)
  amount: number

  @Field(() => Float)
  count: number
}

@ObjectType()
export class DriverTransactionSummaryPayload {
  @Field(() => TransactionSummaryPayload)
  monthly: TransactionSummaryPayload

  @Field(() => TransactionSummaryPayload)
  pending: TransactionSummaryPayload

  @Field(() => TransactionSummaryPayload)
  paid: TransactionSummaryPayload

  @Field(() => TransactionSummaryPayload)
  all: TransactionSummaryPayload
}

@ObjectType()
export class TransactionDetailPayload {
  @Field(() => Transaction)
  transaction: Transaction

  @Field(() => Shipment, { nullable: true })
  shipment?: Shipment

  @Field(() => DriverPayment, { nullable: true })
  driverPayment?: DriverPayment
}
