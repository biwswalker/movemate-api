import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import mongoose from "mongoose"
import mongoosePagination from 'mongoose-paginate-v2'

@plugin(mongoosePagination)
@ObjectType()
export class OTPRequst extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  phoneNumber: string

  @Field()
  @Property()
  otp: string

  @Field()
  @Property()
  ref: string

  @Field()
  @Property()
  action: string

  @Field()
  @Property()
  sentDateTime: Date

  @Field()
  @Property()
  countdown: Date

  @Field()
  @Property()
  expireDateTime: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;

  static paginate: mongoose.PaginateModel<typeof OTPRequst>['paginate']
}

const OTPRequstModel = getModelForClass(OTPRequst)

export default OTPRequstModel