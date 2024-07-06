import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"

@ObjectType()
export class Marker extends TimeStamps {
    @Field()
    @Property()
    displayName: string;

    @Field()
    @Property()
    formattedAddress: string;

    @Field()
    @Property()
    latitude: number;

    @Field()
    @Property()
    longitude: number;
}

const MarkerModel = getModelForClass(Marker)

export default MarkerModel