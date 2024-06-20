import { Field, ID, ObjectType } from "type-graphql";
import { prop as Property, Ref, getModelForClass } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { User } from "./user.model";
import { GraphQLJSONObject } from 'graphql-type-json'

@ObjectType()
export class UpdateHistory extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @Property({ required: true })
  referenceId: string;

  @Field()
  @Property({ required: true })
  referenceType: number;

  @Field(() => GraphQLJSONObject)
  @Property({ type: Object })
  beforeUpdate: Record<string, any>;

  @Field(() => GraphQLJSONObject)
  @Property({ type: Object, required: true })
  afterUpdate: Record<string, any>;

  @Field(() => User)
  @Property({ type: User, required: true })
  who: Ref<User>;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const UpdateHistoryModel = getModelForClass(UpdateHistory);

export default UpdateHistoryModel;
