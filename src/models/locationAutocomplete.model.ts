import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"

@ObjectType()
export class LocationAutocomplete extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property()
    name: string;

    @Field()
    @Property()
    description: string;

    @Field()
    @Property()
    placeId: string;
}

const LocationAutocompleteModel = getModelForClass(LocationAutocomplete)

export default LocationAutocompleteModel