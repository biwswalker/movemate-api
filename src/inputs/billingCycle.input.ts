import { Field, InputType } from 'type-graphql'
import { FileInput } from './file.input'
import { EPaymentMethod } from '@enums/payments'
import { EBillingCriteriaState, EBillingCriteriaStatus, EBillingState } from '@enums/billing'

@InputType()
export class GetBillingInput {
  @Field(() => EBillingCriteriaStatus, { nullable: true })
  status?: EBillingCriteriaStatus

  @Field(() => EBillingCriteriaState, { nullable: true })
  state?: EBillingCriteriaState

  @Field({ nullable: true })
  billingNumber?: string

  @Field({ nullable: true })
  receiptNumber?: string

  @Field({ nullable: true })
  customerName?: string

  @Field(() => EPaymentMethod, { nullable: true })
  paymentMethod?: EPaymentMethod

  @Field(() => [Date], { nullable: true })
  billedDate?: Date[]

  @Field(() => [Date], { nullable: true })
  issueDate?: Date[]

  @Field(() => [Date], { nullable: true })
  receiptDate?: Date[]

  @Field({ nullable: true })
  shipmentNumber?: string

  @Field({ nullable: true })
  customerId?: string
}

@InputType()
export class ProcessBillingRefundInput {
  @Field()
  billingId: string

  @Field()
  paymentId: string

  @Field(() => Boolean)
  isRefunded: boolean

  @Field({ nullable: true })
  reason: string

  @Field(() => FileInput, { nullable: true })
  imageEvidence: FileInput

  @Field({ nullable: true })
  paymentDate: Date

  @Field({ nullable: true })
  paymentTime: Date

  @Field({ nullable: true })
  amount: number
}
