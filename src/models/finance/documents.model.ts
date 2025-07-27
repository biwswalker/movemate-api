import { Field, ID, ObjectType } from 'type-graphql'
import { getModelForClass, plugin, prop as Property, Ref } from '@typegoose/typegoose'
import { User } from '@models/user.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class BillingDocument {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  filename: string

  @Field({ nullable: true })
  @Property({ required: false })
  emailTime: Date

  @Field({ nullable: true })
  @Property({ required: false })
  postalTime: Date

  @Field({ nullable: true })
  @Property({ required: false })
  trackingNumber: string

  @Field({ nullable: true })
  @Property({ required: false })
  provider: string

  @Field({ nullable: true })
  @Property({ required: false })
  receviedWHTDocumentDate: Date

  @Field({ nullable: true })
  @Property({ required: false })
  documentNumber: string

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  updatedBy: Ref<User>
}

const BillingDocumentModel = getModelForClass(BillingDocument)

export default BillingDocumentModel
