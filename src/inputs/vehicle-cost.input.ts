import { ArgsType, Field, Float, ID, InputType } from "type-graphql";

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


@InputType()
export class DistanceCostPricingInput {
    @Field()
    readonly _id: string

    @Field(() => Float)
    from: number

    @Field(() => Float)
    to: number

    @Field()
    unit: TDistanceCostPricingUnit

    @Field(() => Float)
    cost: number

    @Field(() => Float)
    price: number

    @Field(() => Float)
    benefits: number
}

@ArgsType()
export class PricingCalculationMethodArgs {
    /**
     * @description Kilometers
     */
    @Field(() => Float, { nullable: true })
    distance: number
    /**
     * @description Kilometers
     */
    @Field(() => Float, { nullable: true })
    returnedDistance: number
    /**
     * @description Drop point not included start point
     */
    @Field(() => Float, { nullable: true })
    dropPoint: number

    @Field({ nullable: true })
    isRounded: boolean
}