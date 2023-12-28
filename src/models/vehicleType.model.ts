import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { Length } from "class-validator";
import { VehicleCost } from "./vehicleCost.model";

enum EVehicleType {
    FOUR_WHEELER = 'FOUR_WHEELER',
    SIX_WHEELER = 'SIX_WHEELER',
    TEN_WHEELER = 'TEN_WHEELER',
    TRAILER = 'TRAILER',
}

@ObjectType()
export class VehicleType {
    @Field(() => ID)
    readonly _id: string

    @Field(() => VehicleCost, { nullable: true })
    @Property()
    vehicle_cost: Ref<VehicleCost>

    @Field()
    @Property({ enum: EVehicleType, required: true })
    vehicle_type: TVehicleType

    @Field()
    @Length(0, 100)
    @Property({ required: true })
    description_1: string;

    @Field()
    @Length(0, 100)
    @Property({ required: true })
    description_2: string;

    @Field()
    @Length(0, 100)
    @Property({ required: true })
    description_3: string;

    @Field()
    @Property({ required: true })
    full_description: string;

    @Field()
    @Property({ required: true })
    thumbnail_image: string;


    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const VehicleTypeModel = getModelForClass(VehicleType)

export default VehicleTypeModel