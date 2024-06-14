import { Field, ID, ObjectType } from "type-graphql";
import {
  prop as Property,
  Ref,
  getModelForClass,
  plugin,
} from "@typegoose/typegoose";
import { VehicleType } from "./vehicleType.model";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { AdditionalServiceCostPricing } from "./additionalServiceCostPricing.model";
import { DistanceCostPricing } from "./distanceCostPricing.model";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { Types } from "mongoose";
import { filter, forEach, get, isEmpty, some } from "lodash";

@plugin(mongooseAutoPopulate)
@ObjectType()
export class VehicleCost extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field(() => VehicleType)
  @Property({
    required: true,
    unique: true,
    autopopulate: true,
    ref: () => VehicleType,
  })
  vehicleType: Ref<VehicleType>;

  @Field(() => [AdditionalServiceCostPricing])
  @Property({ autopopulate: true, ref: () => AdditionalServiceCostPricing })
  additionalServices: Ref<AdditionalServiceCostPricing>[];

  @Field(() => [DistanceCostPricing])
  @Property({ autopopulate: true, ref: () => DistanceCostPricing })
  distance: Ref<DistanceCostPricing>[];

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;

  static async findByAvailableConfig(): Promise<VehicleCost[]> {
    const vehicleCosts = await VehicleCostModel.find();

    forEach(vehicleCosts, (vehicleCost) => {
      const vehicleTypeId = new Types.ObjectId(
        get(vehicleCost, "vehicleType._id", "")
      ).toString();
      const services = get(vehicleCost, "additionalServices", []);
      forEach(services, (service) => {
        service.additionalService.descriptions = get(
          service,
          "additionalService.descriptions",
          []
        )
          .filter((description) =>
            some(
              description.vehicleTypes,
              (type) => type._id.toString() === vehicleTypeId
            )
          )
          .map((description) => {
            description.vehicleTypes = filter(
              get(description, "vehicleTypes", []),
              (type) => type._id.toString() === vehicleTypeId
            );
            return description;
          });
      });
    });
    

    const filterNoConfig = filter(vehicleCosts, (cost) => !isEmpty(cost.distance))

    return filterNoConfig;
  }
}

const VehicleCostModel = getModelForClass(VehicleCost);

export default VehicleCostModel;
