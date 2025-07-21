import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { EAdjustmentNoteType } from '@enums/billing'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { Billing } from './billing.model'
import { User } from '@models/user.model'
import { BillingDocument } from './documents.model'

@ObjectType()
export class AdjustmentItem {
  @Field()
  @Property({ required: true })
  description: string

  @Field(() => Float)
  @Property({ required: true })
  amount: number

  @Field({ nullable: true })
  @Property()
  serviceDate?: Date

  @Field({ nullable: true })
  @Property()
  shipmentNumber?: string
}

@ObjectType()
export class PreviousDocumentReference {
  @Field()
  @Property({ required: true })
  documentNumber: string

  @Field()
  @Property({ required: true })
  documentType: string
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class BillingAdjustmentNote {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  adjustmentNumber: string

  @Field(() => Billing)
  @Property({ ref: 'Billing', required: true })
  billing: Ref<Billing>

  @Field(() => EAdjustmentNoteType)
  @Property({ enum: EAdjustmentNoteType, required: true })
  adjustmentType: EAdjustmentNoteType

  @Field(() => [AdjustmentItem])
  @Property({ type: () => [AdjustmentItem], required: true })
  items: AdjustmentItem[]

  @Field(() => PreviousDocumentReference)
  @Property({ type: () => PreviousDocumentReference, required: true })
  previousDocumentRef: PreviousDocumentReference

  // --- ฟิลด์สรุปทางการเงิน ---
  @Field(() => Float)
  @Property({ required: true, default: 0 })
  originalSubTotal: number // มูลค่าตามใบแจ้งหนี้เดิม

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  adjustmentSubTotal: number // ผลต่าง (ยอดรวมของ items)

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  newSubTotal: number // มูลค่าที่ถูกต้อง

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  taxAmount: number // ภาษีหัก ณ ที่จ่าย 1% (ของยอดใหม่)

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  totalAmount: number // รวมที่ต้องชำระทั้งสิ้น (ยอดใหม่)

  @Field()
  @Property({ required: true })
  issueDate: Date

  @Field(() => User)
  @Property({ ref: () => User, required: true })
  createdBy: Ref<User>

  @Field({ nullable: true })
  @Property()
  remarks?: string

  @Field(() => BillingDocument, { nullable: true })
  @Property({ ref: () => BillingDocument, autopopulate: true })
  document: Ref<BillingDocument>
}

const BillingAdjustmentNoteModel = getModelForClass(BillingAdjustmentNote)

export default BillingAdjustmentNoteModel
