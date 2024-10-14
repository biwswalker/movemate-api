import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoosePagination from 'mongoose-paginate-v2'

@plugin(mongoosePagination)
@ObjectType()
export class Event extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  start: Date

  @Field()
  @Property()
  end: Date

  @Field()
  @Property()
  title: string

  @Field({ nullable: true })
  @Property()
  color: string

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const EventModel = getModelForClass(Event)

export default EventModel
