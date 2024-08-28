import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { File } from "./file.model"
import mongooseAutoPopulate from "mongoose-autopopulate"

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Refund extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  imageEvidence: Ref<File, string>

  @Field(() => Date)
  @Property()
  paymentDate: Date

  @Field(() => Date)
  @Property()
  paymentTime: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const RefundModel = getModelForClass(Refund)

export default RefundModel