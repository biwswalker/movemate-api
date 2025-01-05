import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { PaymentAmounts } from './objects'
import { BillingDocument } from './documents.model'
import { User } from '@models/user.model'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Invoice extends PaymentAmounts {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  invoiceNumber: string

  @Field()
  @Property({ required: true })
  invoiceDate: Date

  @Field()
  @Property()
  name: string

  @Field()
  @Property()
  address: string

  @Field()
  @Property()
  province: string

  @Field()
  @Property()
  district: string

  @Field()
  @Property()
  subDistrict: string

  @Field()
  @Property()
  postcode: string

  @Field()
  @Property()
  contactNumber: string

  @Field(() => BillingDocument, { nullable: true })
  @Property({ ref: () => BillingDocument, autopopulate: true })
  document: Ref<BillingDocument>

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  updatedBy: Ref<User>
}

const InvoiceModel = getModelForClass(Invoice)

export default InvoiceModel
