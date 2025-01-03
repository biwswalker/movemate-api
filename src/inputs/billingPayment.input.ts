import { Field, InputType } from 'type-graphql'
import { FileInput } from './file.input'

@InputType()
export class ApprovalBillingPaymentInput {
  @Field()
  billingId: string

  @Field()
  paymentId: string

  @Field()
  result: 'approve' | 'reject'

  @Field({ nullable: true })
  reason?: string

  // For credit payment
  @Field(() => FileInput, { nullable: true })
  imageEvidence?: FileInput

  @Field({ nullable: true })
  paymentDate?: Date

  @Field({ nullable: true })
  paymentTime?: Date
}
