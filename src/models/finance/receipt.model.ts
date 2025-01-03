import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { ClientSession } from 'mongoose'
import { PaymentAmounts } from './objects'
import { BillingDocument } from './documents.model'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Receipt extends PaymentAmounts {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  receiptNumber: string

  @Field()
  @Property({ required: true })
  receiptDate: Date

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
}

const ReceiptModel = getModelForClass(Receipt)

export default ReceiptModel
