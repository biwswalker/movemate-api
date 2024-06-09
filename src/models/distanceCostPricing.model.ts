import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { IsEnum, IsNotEmpty } from "class-validator";

enum EDistanceCostPricingUnit {
    LUMSUM = "lumpsum",
    KM = "km",
}

@ObjectType()
export class DistanceCostPricing extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field(() => Float)
    @Property({ required: true })
    form: number

    @Field(() => Float, { nullable: true })
    @Property()
    to: number

    @Field()
    @IsEnum(EDistanceCostPricingUnit)
    @IsNotEmpty()
    @Property({ enum: EDistanceCostPricingUnit, default: EDistanceCostPricingUnit.KM, required: true })
    unit: TDistanceCostPricingUnit

    @Field(() => Float)
    @Property({ required: true })
    cost: number

    @Field(() => Float)
    @Property({ required: true })
    price: number

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const DistanceCostPricingModel = getModelForClass(DistanceCostPricing)

export default DistanceCostPricingModel