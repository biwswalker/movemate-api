import { Field, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { BillingCycle, EBillingStatus } from '@models/billingCycle.model'

@ObjectType()
export class BillingCyclePaginationAggregatePayload extends PaginationPayload implements AggregatePaginateResult<BillingCycle> {
  @Field(() => [BillingCycle])
  docs: BillingCycle[]
}

@ObjectType()
export class TotalBillingRecordPayload {
  @Field()
  label: string

  @Field()
  key: EBillingStatus | 'all'

  @Field(() => Int)
  count: number
}