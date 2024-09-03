import { Field, Int, ObjectType } from 'type-graphql'

@ObjectType()
export class LocationRequestLimitPayload {
  @Field(() => Int)
  count: number
  @Field(() => Int)
  limit: number
}
