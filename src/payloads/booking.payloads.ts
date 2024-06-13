import { VehicleCost } from '@models/vehicleCost.model'
import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class paymentMethodPayload {
    @Field()
    available: boolean

    @Field()
    method: string
}

@ObjectType()
export class BookingConfigPayload {

    @Field(() => [VehicleCost])
    vehicleCosts: VehicleCost[]

    // @Field()
    // faveriteDrivers: string[]

    @Field(() => [paymentMethodPayload])
    paymentMethods: paymentMethodPayload[]
}