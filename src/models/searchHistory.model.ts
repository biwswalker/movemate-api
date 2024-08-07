import { Field, ID, Int, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { User } from "./user.model";
import { Schema } from "mongoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";


@ObjectType()
export class SearchHistory extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  ipaddress: string

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, type: Schema.Types.ObjectId, required: false })
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
}

const SearchHistoryModel = getModelForClass(SearchHistory)

export default SearchHistoryModel