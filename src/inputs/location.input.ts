import { ArgsType, Field, Float, InputType } from "type-graphql"

@ArgsType()
export class SearchLocationsArgs {
    @Field(() => Float)
    latitude: number

    @Field(() => Float)
    longitude: number

    @Field()
    query: string
}

@InputType()
export class LocationInput {
    @Field(() => Float)
    latitude: number

    @Field(() => Float)
    longitude: number
}
