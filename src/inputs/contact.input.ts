import { Field, InputType } from 'type-graphql'

@InputType()
export class ContactInput {
  @Field()
  fullname: string

  @Field()
  email: string

  @Field()
  title: string

  @Field()
  detail: string
}
