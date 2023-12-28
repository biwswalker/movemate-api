import { Field, ObjectType } from "type-graphql"

@ObjectType()
class DistanceValue {
    @Field()
    value: number

    @Field()
    text: string
}

@ObjectType()
class DistanceMatrixElement {
    @Field()
    status: string

    @Field(() => DistanceValue)
    duration: DistanceValue

    @Field(() => DistanceValue)
    distance: DistanceValue
}

@ObjectType()
export class DistanceMatrix {
    @Field()
    status: string

    @Field(() => [String])
    origin_addresses: string[]

    @Field(() => [String])
    destination_addresses: string[]

    @Field(() => [DistanceMatrixElement])
    result: DistanceMatrixElement[]
}