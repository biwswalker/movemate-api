import { Field, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { EBillingCriteriaStatus } from '@enums/billing'
import { Billing } from '@models/finance/billing.model'

@ObjectType()
export class BillingListPayload extends PaginationPayload implements AggregatePaginateResult<Billing> {
  @Field(() => [Billing])
  docs: Billing[]
}

@ObjectType()
export class TotalBillingRecordPayload {
  @Field()
  label: string

  @Field()
  key: EBillingCriteriaStatus

  @Field(() => Int)
  count: number
}