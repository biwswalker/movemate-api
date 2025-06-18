import { Field, ID, Int, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { User } from "./user.model";
import mongoose, { Schema } from "mongoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import mongoosePagination from 'mongoose-paginate-v2'
import mongooseAutoPopulate from "mongoose-autopopulate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

@plugin(mongooseAggregatePaginate)
@plugin(mongooseAutoPopulate)
@plugin(mongoosePagination)
@ObjectType()
export class SearchHistory extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field({ nullable: true })
  @Property()
  ipaddress: string

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, type: Schema.Types.ObjectId, required: false, autopopulate: true })
  user?: Ref<User>

  @Field()
  @Property()
  type: TSearchType

  @Field()
  @Property()
  isCache: boolean

  @Field(() => Int)
  @Property()
  count: number

  @Field(() => Int)
  @Property()
  limit: number

  @Field({ nullable: true })
  @Property({ required: false })
  inputRaw: string

  @Field({ nullable: true })
  @Property({ required: false })
  resultRaw: string

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static paginate: mongoose.PaginateModel<typeof SearchHistory>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof SearchHistory>['aggregatePaginate']
}

const SearchHistoryModel = getModelForClass(SearchHistory)

export default SearchHistoryModel