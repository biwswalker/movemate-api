import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { VehicleType } from "./vehicleType.model";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { AdditionalServiceCostPricing } from "./additionalServiceCostPricing.model";
import { DistanceCostPricing } from "./distanceCostPricing.model";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { Schema } from "mongoose";

@plugin(mongooseAutoPopulate)
@ObjectType()
export class VehicleCost extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field(() => VehicleType)
    @Property({ required: true, unique: true, autopopulate: true, ref: () => VehicleType })
    vehicleType: Ref<VehicleType>

    @Field(() => [AdditionalServiceCostPricing])
    @Property({ autopopulate: true, ref: () => AdditionalServiceCostPricing })
    additionalServices: Ref<AdditionalServiceCostPricing>[]

    @Field(() => [DistanceCostPricing])
    @Property({ autopopulate: true, ref: () => DistanceCostPricing })
    distance: Ref<DistanceCostPricing>[]

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const VehicleCostModel = getModelForClass(VehicleCost)

export default VehicleCostModel