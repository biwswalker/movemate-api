import { ArgsType, Field } from "type-graphql";
import { FileInput } from "./file.input";

@ArgsType()
export class ApprovalCashPaymentArgs {
  @Field()
  billingCycleId: string;

  @Field()
  result: 'approve' | 'reject';

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  otherReason?: string;
}

@ArgsType()
export class ApproveCreditPaymentArgs {
  @Field()
  billingCycleId: string

  @Field(() => FileInput, { nullable: true })
  imageEvidence?: FileInput

  @Field()
  paymentDate: Date

  @Field()
  paymentTime: Date
}