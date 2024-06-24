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
import { DistanceCostPricing, EDistanceCostPricingUnit } from "./distanceCostPricing.model";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { Types } from "mongoose";
import { filter, forEach, get, isEmpty, some } from "lodash";
import { PricingCalculationMethodArgs } from "@inputs/vehicle-cost.input";
import { GraphQLError } from "graphql";
import { CalculationResultPayload, PricingCalculationMethodPayload } from "@payloads/pricing.payloads";

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

  static async calculatePricing(_id: string, data: PricingCalculationMethodArgs): Promise<PricingCalculationMethodPayload> {
    const vehicleCost = await VehicleCostModel.findById(_id).populate("distance").populate({
      path: "additionalServices",
      match: { available: true },
      populate: {
        path: "additionalService",
        model: "AdditionalService",
      },
    }).lean();

    if (!vehicleCost) {
      const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`;
      throw new GraphQLError(message, {
        extensions: { code: "NOT_FOUND", errors: [{ message }] },
      });
    }

    const steps = vehicleCost.distance as DistanceCostPricing[]
    if (!steps.length) {
      const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`;
      throw new GraphQLError(message, {
        extensions: { code: "NOT_FOUND", errors: [{ message }] },
      });
    }

    let subTotalCost = 0
    let subTotalPrice = 0
    const calculations: CalculationResultPayload[] = []

    const { distance } = data
    forEach(steps, (step) => {
      if (distance >= step.from) {
        const stepTo = step.to === step.from ? Infinity : step.to
        const applicableDistance = Math.min(distance, stepTo ?? distance) - step.from + 1
        const calculatedCost = step.unit === EDistanceCostPricingUnit.KM ? step.cost * applicableDistance : step.cost
        const calculatedPrice = step.unit === EDistanceCostPricingUnit.KM ? step.price * applicableDistance : step.price

        subTotalCost += calculatedCost
        subTotalPrice += calculatedPrice

        calculations.push({
          ...step,
          costResult: calculatedCost,
          priceResult: calculatedPrice,
        })

      }
    })

    return {
      subTotalDropPointCost: 0,
      subTotalDropPointPrice: 0,
      subTotalCost,
      subTotalPrice,
      totalCost: 0,
      totalPrice: 0,
      calculations
    }
  }
}

const VehicleCostModel = getModelForClass(VehicleCost);

export default VehicleCostModel;
