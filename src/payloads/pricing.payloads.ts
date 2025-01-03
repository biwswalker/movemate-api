import { ObjectType, Field, Float } from 'type-graphql'
import { DistanceCostPricing } from '@models/distanceCostPricing.model'
import { VehicleCost } from '@models/vehicleCost.model'
import { prop as Property, Severity } from '@typegoose/typegoose'

@ObjectType()
export class CalculationResultPayload extends DistanceCostPricing {
  @Field(() => Float)
  calculatedCost: number

  @Field(() => Float)
  calculatedPrice: number
}

@ObjectType()
export class PricingCalculationMethodPayload {
  @Field(() => [CalculationResultPayload])
  @Property({ allowMixed: Severity.ALLOW })
  calculations: CalculationResultPayload[]

  @Field(() => Float)
  @Property()
  subTotalDropPointCost: number

  @Field(() => Float)
  @Property()
  subTotalDropPointPrice: number

  @Field(() => Float)
  @Property()
  subTotalCost: number

  @Field(() => Float)
  @Property()
  subTotalPrice: number

  @Field(() => Float)
  @Property()
  subTotalRoundedCost: number

  @Field(() => Float)
  @Property()
  subTotalRoundedPrice: number

  @Field(() => Float)
  @Property()
  totalCost: number

  @Field(() => Float)
  @Property()
  totalPrice: number

  @Field(() => Float)
  @Property()
  roundedCostPercent: number

  @Field(() => Float)
  @Property()
  roundedPricePercent: number

  @Field(() => Float)
  @Property()
  totalTax: number
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
  subTotalRoundedCost?: number

  @Field(() => Float, { nullable: true })
  subTotalRoundedPrice?: number

  @Field(() => Float, { nullable: true })
  totalCost?: number

  @Field(() => Float, { nullable: true })
  totalPrice?: number
}
