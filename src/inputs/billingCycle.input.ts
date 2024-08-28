import { ArgsType, Field } from "type-graphql";
import { FileInput } from "./file.input";

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

  @Field({ nullable: true })
  paymentMethod?: TPaymentMethod

  @Field(() => [Date], { nullable: true })
  billedDate?: Date[]

  @Field(() => [Date], { nullable: true })
  issueDate?: Date[]

  @Field(() => [Date], { nullable: true })
  receiptDate?: Date[]
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