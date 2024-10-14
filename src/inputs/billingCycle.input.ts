import { ArgsType, Field } from 'type-graphql'
import { FileInput } from './file.input'
import { EPaymentMethod } from '@models/payment.model'

@ArgsType()
export class GetBillingCycleArgs {
  @Field({ nullable: true })
  status?: TBillingCriteriaStatus

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

@ArgsType()
export class BillingCycleRefundArgs {
  @Field()
  billingCycleId: string

  @Field(() => FileInput)
  imageEvidence: FileInput

  @Field()
  paymentDate: Date

  @Field()
  paymentTime: Date
}
