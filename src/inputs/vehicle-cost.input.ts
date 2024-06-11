import { Field, Float, ID, InputType } from "type-graphql";

@InputType()
export class AdditionalServiceCostInput {
    @Field()
    _id: string

    @Field()
    available: boolean

    @Field()
    additionalService: string

    @Field()
    type: TAdditionalServiceCostPricingUnit

    @Field(() => Float)
    cost: number

    @Field(() => Float)
    price: number
}
