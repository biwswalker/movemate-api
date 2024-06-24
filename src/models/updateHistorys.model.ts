import { Field, ID, ObjectType } from "type-graphql";
import { prop as Property, Ref, Severity, getModelForClass, plugin } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { User } from "./user.model";
import { GraphQLJSONObject } from 'graphql-type-json'
import { Schema } from "mongoose";
import mongooseAutoPopulate from "mongoose-autopopulate";

@ObjectType()
@plugin(mongooseAutoPopulate)
export class UpdateHistory extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @Property({ required: true })
  referenceId: string;

  @Field()
  @Property({ required: true })
  referenceType: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property({ type: Object, allowMixed: Severity.ALLOW })
  beforeUpdate: Record<string, any>;

  @Field(() => GraphQLJSONObject)
  @Property({ type: Object, required: true, allowMixed: Severity.ALLOW })
  afterUpdate: Record<string, any>;

  @Field(() => User)
  @Property({
    ref: () => User,
    type: Schema.Types.ObjectId,
    autopopulate: true,
  })
  who: Ref<User, string>;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const UpdateHistoryModel = getModelForClass(UpdateHistory);

export default UpdateHistoryModel;
