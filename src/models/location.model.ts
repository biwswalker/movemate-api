import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class Location {
    @Field()
    @Property()
    latitude: number

    @Field()
    @Property()
    longitude: number
}

const LocationModel = getModelForClass(Location)

export default LocationModel