import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoosePagination from 'mongoose-paginate-v2'

@plugin(mongoosePagination)
@ObjectType()
export class Contact extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  fullname: string

  @Field()
  @Property()
  email: string

  @Field()
  @Property()
  title: string

  @Field()
  @Property()
  detail: string

  @Field()
  @Property({ default: false })
  read: boolean
  
  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date
}

const ContactModel = getModelForClass(Contact)

export default ContactModel
