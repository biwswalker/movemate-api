import { Field, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { EBillingCriteriaStatus, EBillingInfoStatus, EBillingState, EBillingStatus } from '@enums/billing'
import { Billing } from '@models/finance/billing.model'
import { EPaymentMethod } from '@enums/payments'

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

@ObjectType()
export class BillingInfoPayload {
  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field({ nullable: true })
  billingNumber?: string

  @Field(() => EBillingState, { nullable: true })
  billingStatus?: EBillingStatus
  
  @Field(() => EBillingState, { nullable: true })
  billingState?: EBillingState

  @Field(() => EBillingInfoStatus)
  status: EBillingInfoStatus

  @Field({ nullable: true })
  message?: string
}