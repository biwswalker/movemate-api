


import { ObjectType, Field } from 'type-graphql'
import { VehicleType } from '@models/vehicleType.model'

@ObjectType()
export class VehicleTypeConfigureStatusPayload extends VehicleType {
    @Field()
    isAdditionalServicesConfigured: boolean

    @Field()
    isDistancesConfigured: boolean

    @Field()
    isConfigured: boolean
}
