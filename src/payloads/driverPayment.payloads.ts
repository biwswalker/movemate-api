import { Field, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { DriverPayment } from '@models/driverPayment.model'

@ObjectType()
export class DriverPaymentAggregatePayload extends PaginationPayload implements AggregatePaginateResult<DriverPayment> {
  @Field(() => [DriverPayment])
  docs: DriverPayment[]
}

// @ObjectType()
// export class TransactionDriversTotalRecordPayload {
//   @Field()
//   label: string

//   @Field(() => ETransactionDriverStatus)
//   key: ETransactionDriverStatus

//   @Field(() => Int)
//   count: number
// }
