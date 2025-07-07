import { EAdjustmentNoteType } from '@enums/billing'
import { Field, Float, InputType } from 'type-graphql'

@InputType()
export class AdjustmentItemInput {
  @Field()
  description: string

  @Field(() => Float)
  amount: number

  @Field(() => Date, { nullable: true })
  serviceDate: Date

  @Field({ nullable: true })
  shipmentNumber: string
}

@InputType()
export class CreateAdjustmentNoteInput {
  @Field(() => String)
  billingId: string

  @Field(() => EAdjustmentNoteType)
  adjustmentType: EAdjustmentNoteType

  @Field(() => [AdjustmentItemInput])
  items: AdjustmentItemInput[]

  @Field(() => Date, { nullable: true })
  issueDate?: Date

  @Field(() => String, { nullable: true })
  remarks?: string
}
