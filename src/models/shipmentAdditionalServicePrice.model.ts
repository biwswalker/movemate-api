import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { AdditionalServiceCostPricing } from "./additionalServiceCostPricing.model";


@plugin(mongooseAutoPopulate)
@ObjectType()
export class ShipmentAdditionalServicePrice extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field(() => AdditionalServiceCostPricing)
    @Property({ required: true, autopopulate: true, ref: () => AdditionalServiceCostPricing })
    reference: Ref<AdditionalServiceCostPricing>

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

const ShipmentAdditionalServicePriceModel = getModelForClass(ShipmentAdditionalServicePrice)

export default ShipmentAdditionalServicePriceModel