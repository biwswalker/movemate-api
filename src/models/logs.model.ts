import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { User } from './user.model'
import { GraphQLJSONObject } from 'graphql-type-json'

@ObjectType()
export class Logs {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ required: true, autopopulate: true, ref: 'User' })
  user: Ref<User>

  @Field()
  @Property({ required: true })
  action: string

  @Field()
  @Property({ required: true })
  description: string

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property({ required: true })
  public metadata?: Record<string, any>

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  static async add(userId: string, action: string, message: string, metadata = {}) {
    const newLog = new LogsModel({
      user: userId,
      action,
      description: message,
      metadata,
    })
    return newLog.save()
  }
}

const LogsModel = getModelForClass(Logs)

export default LogsModel
