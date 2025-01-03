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
import { ClientSession, Types } from "mongoose";
import { filter, find, forEach, get, isEmpty, some, sum } from "lodash";
import { PricingCalculationMethodArgs } from "@inputs/vehicle-cost.input";
import { GraphQLError } from "graphql";
import { CalculationResultPayload, PricingCalculationMethodPayload } from "@payloads/pricing.payloads";
import { AdditionalService } from "./additionalService.model";
import { GET_VEHICLE_COST } from "@pipelines/pricing.pipeline";
import { calculateStep } from "@controllers/quotation";
import { VALUES } from "constants/values";

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

  static async findByVehicleId(id: string, session?: ClientSession): Promise<VehicleCost> {
    const vehicleCost = await VehicleCostModel.aggregate(GET_VEHICLE_COST(id)).session(session)
    return vehicleCost[0]
  }

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

    const originCalculation = calculateStep(data.distance, steps)
    const subTotalCost = originCalculation.cost
    const subTotalPrice = originCalculation.price

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
    let roundedCostPercent = 0
    let roundedPricePercent = 0
    if (data.isRounded) {
      const additionalServiceRouned = find(additionalServices, (service: AdditionalServiceCostPricing) => {
        const coreService = service.additionalService as AdditionalService
        return coreService.name === VALUES.ROUNDED_RETURN
      })

      // As percent
      if (additionalServiceRouned) {
        roundedCostPercent = (additionalServiceRouned.cost || 0)
        roundedPricePercent = (additionalServiceRouned.price || 0)
        const roundedCostPercentCal = (additionalServiceRouned.cost || 0) / 100
        const roundedPricePercentCal = (additionalServiceRouned.price || 0) / 100

        // Round calculation
        const roundedCalculation = calculateStep(data.returnedDistance, steps)

        subTotalRoundedCost = roundedCostPercentCal * roundedCalculation.cost
        subTotalRoundedPrice = roundedPricePercentCal * roundedCalculation.price
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
      roundedCostPercent,
      roundedPricePercent,
      totalCost,
      totalPrice,
      calculations: originCalculation.calculations,
      totalTax: 0 // TODO: Check again
    }
  }
}

const VehicleCostModel = getModelForClass(VehicleCost);

export default VehicleCostModel;
