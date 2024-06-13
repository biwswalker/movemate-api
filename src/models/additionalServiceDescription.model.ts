import { Field, ID, ObjectType } from "type-graphql";
import {
    Ref,
    plugin,
    prop as Property,
    getModelForClass,
} from "@typegoose/typegoose";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { VehicleType } from "./vehicleType.model";

@plugin(mongooseAutoPopulate)
@ObjectType()
export class AdditionalServiceDescription {
    @Field(() => ID)
    readonly _id: string;

    @Field()
    @Property()
    detail: string;

    @Field(() => [VehicleType])
    @Property({
        autopopulate: true,
        ref: () => VehicleType,
    })
    vehicleTypes: Ref<VehicleType>[];
}

const AdditionalServiceDescriptionModel = getModelForClass(AdditionalServiceDescription);

export default AdditionalServiceDescriptionModel;