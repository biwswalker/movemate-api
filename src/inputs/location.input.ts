import { ArgsType, Field, Float } from "type-graphql"

@ArgsType()
export class SearchLocationsArgs {
    @Field(() => Float)
    latitude: number

    @Field(() => Float)
    longitude: number

    @Field()
    query: string
}
