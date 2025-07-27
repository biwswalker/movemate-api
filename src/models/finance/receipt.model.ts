import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { ClientSession } from 'mongoose'
import { PaymentAmounts } from './objects'
import { BillingDocument } from './documents.model'
import { EReceiptType } from '@enums/billing'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Receipt extends PaymentAmounts {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  receiptNumber: string

  @Field({ nullable: true })
  @Property({ required: false })
  refReceiptNumber: string

  @Field()
  @Property({ required: true })
  receiptDate: Date

  @Field(() => EReceiptType)
  @Property({ enum: EReceiptType, required: true, default: EReceiptType.FINAL })
  receiptType: EReceiptType // <-- เพิ่มฟิลด์ประเภท

  @Field(() => BillingDocument, { nullable: true })
  @Property({ ref: () => BillingDocument, autopopulate: true })
  document: Ref<BillingDocument>

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field({ nullable: true })
  @Property({ required: false })
  updatedBy: string

  @Field({ nullable: true })
  @Property()
  remarks?: string
}

const ReceiptModel = getModelForClass(Receipt)

export default ReceiptModel
