import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"

@ObjectType()
export class Location extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property()
    name: string;

    @Field()
    @Property()
    latitude: number;

    @Field()
    @Property()
    longitude: number;

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const LocationModel = getModelForClass(Location)

export default LocationModel