import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import mongooseAutoPopulate from "mongoose-autopopulate"

@plugin(mongooseAutoPopulate)
@ObjectType()
export class BillingReceipt extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  receiptNumber: string

  @Field(() => Float)
  @Property({ required: true })
  paidAmount: number;

  @Field()
  @Property({ required: true })
  receiptDate: Date;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field({ nullable: true })
  @Property({ required: false })
  updatedBy: string
}

const BillingReceiptModel = getModelForClass(BillingReceipt)

export default BillingReceiptModel
