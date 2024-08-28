import { ArgsType, Field } from "type-graphql";

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