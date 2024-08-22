import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class ApprovalCashPaymentArgs {
  @Field()
  _id: string;

  @Field()
  shipmentId: string;

  @Field()
  result: 'approve' | 'reject';

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  otherReason?: string;
}