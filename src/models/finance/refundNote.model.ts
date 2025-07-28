import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { Billing } from './billing.model'
import { BillingDocument } from './documents.model'
import { ERefundAmountType } from '@enums/billing'

@ObjectType()
export class RefundNote {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true, unique: true })
  refundNoteNumber: string

  @Field()
  @Property({ required: true })
  refAdvanceReceiptNo: string

  @Field(() => Billing)
  @Property({ ref: 'Billing', required: true })
  billing: Ref<Billing>

  @Field(() => ERefundAmountType)
  @Property({ required: true })
  amountType: ERefundAmountType

  @Field(() => Float)
  @Property({ required: true })
  amount: number // ยอดเงินที่คืน

  @Field({ nullable: true })
  @Property({ required: false })
  refundDate: Date // วันที่ทำการคืนเงิน

 @Field(() => BillingDocument, { nullable: true }) // Explicitly provide the type function
  @Property({ ref: () => BillingDocument })
  document?: Ref<BillingDocument>;

  @Field({ nullable: true })
  @Property({ required: false })
  remark?: string
}

const RefundNoteModel = getModelForClass(RefundNote)
export default RefundNoteModel
