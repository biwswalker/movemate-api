import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { User } from './user.model'
import { EAdjustmentNoteType } from '@enums/billing'
import { IsEnum } from 'class-validator'
import { BillingPayment } from './billingPayment.model'

@ObjectType()
export class BillingAdjustmentNote {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ ref: () => User, required: true, autopopulate: true })
  createdBy: Ref<User>

  @Field()
  @Property({ required: true })
  billingCycleId: string

  @Field(() => EAdjustmentNoteType)
  @IsEnum(EAdjustmentNoteType)
  @Property({ enum: EAdjustmentNoteType, required: true })
  adjustmentType: EAdjustmentNoteType

  @Field()
  @Property({ required: true })
  adjustmentNumber: string // หมายเลขเอกสาร

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  adjustmentAmount: number // จำนวนเงินรวมที่มีการปรับปรุง

  @Field({ nullable: true })
  @Property()
  adjustmentReason?: string // เหตุผลในการแก้ไข

  @Field(() => Date)
  @Property({ required: true })
  issueDate: Date // วันที่ออกเอกสาร

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  adjustmentDate?: Date // วันที่ใช้ในการปรับยอด

  @Field(() => BillingPayment, { nullable: true })
  @Property({ ref: () => BillingPayment, required: false, autopopulate: true })
  payment?: Ref<BillingPayment> // การชำระเงินที่เกี่ยวข้อง

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const BillingAdjustmentNoteModel = getModelForClass(BillingAdjustmentNote)

export default BillingAdjustmentNoteModel
