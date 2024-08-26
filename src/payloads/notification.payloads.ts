import { ObjectType, Field, Int } from 'type-graphql'

@ObjectType()
export class AdminNotificationCountPayload {
  @Field(() => Int)
  customer: number
  @Field(() => Int)
  individualCustomer: number
  @Field(() => Int)
  businessCustomer: number
  @Field(() => Int)
  driver: number
  @Field(() => Int)
  individualDriver: number
  @Field(() => Int)
  businessDriver: number
  @Field(() => Int)
  shipment: number
  @Field(() => Int)
  financial: number
}