import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { EAdjustmentNoteType, EBillingStatus } from '@enums/billing'
import { IsEnum } from 'class-validator'
import { Payment } from './payment.model'

@ObjectType()
export class BillingAdjustmentNote {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  adjustmentNumber: string

  @Field(() => EBillingStatus)
  @IsEnum(EBillingStatus)
  @Property({ enum: EBillingStatus, default: EBillingStatus.PENDING })
  status: EBillingStatus

  @Field()
  @Property({ required: true })
  billingId: string

  @Field(() => EAdjustmentNoteType)
  @IsEnum(EAdjustmentNoteType)
  @Property({ enum: EAdjustmentNoteType, required: true })
  adjustmentType: EAdjustmentNoteType

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  adjustmentAmount: number // จำนวนเงินรวมที่มีการปรับปรุง

  @Field({ nullable: true })
  @Property()
  adjustmentReason?: string // เหตุผลในการแก้ไข

  @Field(() => Date)
  @Property({ required: true })
  issueDate: Date // วันที่ออกเอกสาร

  @Field(() => Payment, { nullable: true })
  @Property({ ref: () => Payment, required: false, autopopulate: true })
  payment?: Ref<Payment> // การชำระเงินที่เกี่ยวข้อง

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const BillingAdjustmentNoteModel = getModelForClass(BillingAdjustmentNote)

export default BillingAdjustmentNoteModel
