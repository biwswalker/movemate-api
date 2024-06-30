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
import { filter, find, forEach, get, isEmpty, some, sum } from "lodash";
import { PricingCalculationMethodArgs } from "@inputs/vehicle-cost.input";
import { GraphQLError } from "graphql";
import { CalculationResultPayload, PricingCalculationMethodPayload } from "@payloads/pricing.payloads";
import { AdditionalService } from "./additionalService.model";

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


    const filterNoConfig = filter(vehicleCosts, (cost) => {
      const isPublic = get(cost, 'vehicleType.isPublic', false)
      return !isEmpty(cost.distance) && isPublic
    })

    return filterNoConfig;
  }

  static async calculatePricing(_id: string, data: PricingCalculationMethodArgs): Promise<PricingCalculationMethodPayload> {
    const vehicleCost = await VehicleCostModel.findById(_id)
      .populate({ path: "distance", options: { sort: { from: 1 } } })
      .populate({
        path: "additionalServices",
        match: { available: true },
        populate: {
          path: "additionalService",
          model: "AdditionalService",
        },
      })
      .lean();

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

    // Calculate for each distance
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

    // Additional Service
    const additionalServices = vehicleCost.additionalServices as AdditionalServiceCostPricing[]

    // Calculate drop point
    const dropPoint = data.dropPoint - 1
    let subTotalDropPointCost = 0
    let subTotalDropPointPrice = 0
    if (dropPoint > 0) {
      const additionalServiceDroppoint = find(additionalServices, (service: AdditionalServiceCostPricing) => {
        const coreService = service.additionalService as AdditionalService
        return coreService.name === 'หลายจุดส่ง'
      })

      if (additionalServiceDroppoint) {
        const droppointCost = additionalServiceDroppoint.cost || 0
        const droppointPrice = additionalServiceDroppoint.price || 0

        subTotalDropPointCost = dropPoint * droppointCost
        subTotalDropPointPrice = dropPoint * droppointPrice
      }
    }

    // Rounded percent
    let subTotalRoundedCost = 0
    let subTotalRoundedPrice = 0
    if (data.isRounded) {
      const additionalServiceRouned = find(additionalServices, (service: AdditionalServiceCostPricing) => {
        const coreService = service.additionalService as AdditionalService
        return coreService.name === 'ไป-กลับ'
      })

      // As percent
      if (additionalServiceRouned) {
        const roundedCostPercent = (additionalServiceRouned.cost || 0) / 100
        const roundedPricePercent = (additionalServiceRouned.price || 0) / 100


        subTotalRoundedCost = roundedCostPercent * subTotalCost
        subTotalRoundedPrice = roundedPricePercent * subTotalPrice
      }
    }

    // Total
    const totalCost = sum([subTotalDropPointCost, subTotalCost, subTotalRoundedCost])
    const totalPrice = sum([subTotalDropPointPrice, subTotalPrice, subTotalRoundedPrice])

    return {
      subTotalDropPointCost,
      subTotalDropPointPrice,
      subTotalCost,
      subTotalPrice,
      subTotalRoundedCost,
      subTotalRoundedPrice,
      totalCost,
      totalPrice,
      calculations
    }
  }
}

const VehicleCostModel = getModelForClass(VehicleCost);

export default VehicleCostModel;
