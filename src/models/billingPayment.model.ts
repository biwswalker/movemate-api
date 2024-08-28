import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import mongooseAutoPopulate from "mongoose-autopopulate"
import lodash from "lodash"
import Aigle from "aigle"
import { File } from "./file.model"

Aigle.mixin(lodash, {})

export enum EBillingPaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  FAILED = 'failed',
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class BillingPayment extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  paymentNumber: string

  @Field(() => Float)
  @Property({ required: true })
  paymentAmount: number;

  @Field()
  @Property({ required: true })
  paymentDate: Date;

  @Field()
  @Property({ enum: EBillingPaymentStatus, required: true })
  status: EBillingPaymentStatus;

  // 
  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  imageEvidence?: Ref<File, string>

  @Field({ nullable: true })
  @Property()
  bank?: string

  @Field({ nullable: true })
  @Property()
  bankName?: string

  @Field({ nullable: true })
  @Property()
  bankNumber?: string

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const BillingPaymentModel = getModelForClass(BillingPayment)

export default BillingPaymentModel
