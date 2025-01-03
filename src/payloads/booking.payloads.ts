import { VehicleCost } from '@models/vehicleCost.model'
import { ObjectType, Field } from 'type-graphql'
import { User } from '@models/user.model'

@ObjectType()
export class paymentMethodPayload {
  @Field()
  available: boolean

  @Field()
  method: string

  @Field()
  name: string

  @Field()
  subTitle: string

  @Field()
  detail: string
}

@ObjectType()
export class BookingConfigPayload {
  @Field(() => [VehicleCost])
  vehicleCosts: VehicleCost[]

  @Field(() => [User])
  faveriteDrivers: User[]

  @Field(() => [paymentMethodPayload])
  paymentMethods: paymentMethodPayload[]
}