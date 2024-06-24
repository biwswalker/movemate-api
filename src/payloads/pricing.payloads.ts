


import { ObjectType, Field, Float } from 'type-graphql'
import { DistanceCostPricing } from '@models/distanceCostPricing.model'
import { VehicleCost } from '@models/vehicleCost.model'

@ObjectType()
export class CalculationResultPayload extends DistanceCostPricing {
    @Field(() => Float)
    costResult: number

    @Field(() => Float)
    priceResult: number
}

@ObjectType()
export class PricingCalculationMethodPayload {
    @Field(() => [CalculationResultPayload])
    calculations: CalculationResultPayload[]

    @Field(() => Float)
    subTotalDropPointCost: number

    @Field(() => Float)
    subTotalDropPointPrice: number

    @Field(() => Float)
    subTotalCost: number

    @Field(() => Float)
    subTotalPrice: number

    @Field(() => Float)
    totalCost: number

    @Field(() => Float)
    totalPrice: number
}



@ObjectType()
export class VehicleCostCalculationPayload extends VehicleCost {

    @Field(() => [CalculationResultPayload], { nullable: true })
    calculations?: CalculationResultPayload[]

    @Field(() => Float, { nullable: true })
    subTotalDropPointCost?: number

    @Field(() => Float, { nullable: true })
    subTotalDropPointPrice?: number

    @Field(() => Float, { nullable: true })
    subTotalCost?: number

    @Field(() => Float, { nullable: true })
    subTotalPrice?: number

    @Field(() => Float, { nullable: true })
    totalCost?: number

    @Field(() => Float, { nullable: true })
    totalPrice?: number
}