import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { AdditionalService } from "./additionalService.model";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { IsEnum, IsNotEmpty } from "class-validator";
import mongooseAutoPopulate from "mongoose-autopopulate";

enum EAdditionalServiceCostPricingUnit {
    PERCENT = "percent",
    CURRENCY = "currency",
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class AdditionalServiceCostPricing extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    available: boolean

    @Field(() => AdditionalService)
    @Property({ required: true, autopopulate: true, ref: () => AdditionalService })
    additionalService: Ref<AdditionalService>

    @Field()
    @IsEnum(EAdditionalServiceCostPricingUnit)
    @IsNotEmpty()
    @Property({ enum: EAdditionalServiceCostPricingUnit, default: EAdditionalServiceCostPricingUnit.PERCENT, required: true })
    type: TAdditionalServiceCostPricingUnit

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

const AdditionalServiceCostPricingModel = getModelForClass(AdditionalServiceCostPricing)

export default AdditionalServiceCostPricingModel