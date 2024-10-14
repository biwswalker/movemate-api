import { ArgsType, Field, Float, InputType } from 'type-graphql'

@InputType()
export class EventInput {
  @Field({ nullable: true })
  _id: string

  @Field()
  start: Date

  @Field()
  end: Date

  @Field()
  title: string

  @Field({ nullable: true })
  color: string
}
