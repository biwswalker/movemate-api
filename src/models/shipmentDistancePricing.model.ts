import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { ObjectType, Field, ID, Float } from 'type-graphql'
import { EDistanceCostPricingUnit } from './distanceCostPricing.model';
import { IsEnum, IsNotEmpty } from 'class-validator';

@ObjectType()
export class ShipmentDistancePricing {
    @Field(() => ID)
    readonly _id: string

    @Field(() => Float)
    @Property({ required: true })
    from: number;

    @Field(() => Float)
    @Property()
    to: number;

    @Field()
    @IsEnum(EDistanceCostPricingUnit)
    @IsNotEmpty()
    @Property({
        enum: EDistanceCostPricingUnit,
        default: EDistanceCostPricingUnit.KM,
        required: true,
    })
    unit: TDistanceCostPricingUnit;

    @Field(() => Float)
    @Property({ required: true })
    cost: number;

    @Field(() => Float)
    @Property({ required: true })
    price: number;

    @Field(() => Float) // As Percent
    @Property({ required: true })
    benefits: number;
}

const ShipmentDistancePricingModel = getModelForClass(ShipmentDistancePricing)

export default ShipmentDistancePricingModel
