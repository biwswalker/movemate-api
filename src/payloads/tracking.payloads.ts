import { Field, ObjectType } from 'type-graphql'

@ObjectType()
export class DriverLocation {
  @Field() latitude: number
  @Field() longitude: number
}
