import { Arg, Resolver, UseMiddleware, Query, Mutation } from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import VehicleTypeModel, { VehicleType } from "@models/vehicleType.model";
import { GraphQLError } from "graphql";
import VehicleCostModel, { VehicleCost } from "@models/vehicleCost.model";
import {
  AdditionalServiceCostInput,
  DistanceCostPricingInput,
} from "@inputs/vehicle-cost.input";
import {
  AdditionalServiceCostSchema,
  DistanceCostPricingSchema,
} from "@validations/vehiclecost.validations";
import AdditionalServiceCostPricingModel, {
  AdditionalServiceCostPricing,
} from "@models/additionalServiceCostPricing.model";
import { filter, get, isEqual, map } from "lodash";
import { AnyBulkWriteOperation, Types } from "mongoose";
import AdditionalServiceModel from "@models/additionalService.model";
import DistanceCostPricingModel, {
  DistanceCostPricing,
} from "@models/distanceCostPricing.model";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";

@Resolver()
export default class PricingResolver {
  @Query(() => VehicleCost)
  @UseMiddleware(AuthGuard(["admin"]))
  async getVehicleCost(
    @Arg("vehicleTypeId") vehicleTypeId: string
  ): Promise<VehicleCost> {
    try {
      const vehicleCost = await VehicleCostModel.findOne({ vehicleType: vehicleTypeId })
      if (!vehicleCost) {
        const vehicleType = await VehicleTypeModel.findById(vehicleTypeId);
        if (!vehicleType) {
          const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
          throw new GraphQLError(message, {
            extensions: { code: "NOT_FOUND", errors: [{ message }] },
          });
        }
        const vehicleCostTemporary = new VehicleCostModel({
          vehicleType,
          additionalServices: [],
          distance: [],
        });

        return vehicleCostTemporary;
      }
      return vehicleCost;
    } catch (error) {
      console.log("error: ", error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin"]))
  async updateAdditionalServiceCost(
    @Arg("id") id: string,
    @Arg("data", () => [AdditionalServiceCostInput])
    data: AdditionalServiceCostInput[]
  ): Promise<boolean> {
    try {
      await AdditionalServiceCostSchema.validate({ additionalServices: data });

      const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] =
        map(data, ({ _id, ...service }) => {
          const _oid =
            _id === "-" ? new Types.ObjectId() : new Types.ObjectId(_id);
          return {
            updateOne: {
              filter: { _id: _oid },
              update: { $set: { _id: _oid, ...service } },
              upsert: true,
            },
          };
        });
      const serviceIds = map(bulkOps, (opt) =>
        get(opt, "updateOne.filter._id", "")
      );

      await AdditionalServiceCostPricingModel.bulkWrite(bulkOps);

      await VehicleCostModel.findByIdAndUpdate(id, {
        additionalServices: serviceIds,
      });

      await AdditionalServiceCostPricingModel.deleteMany({
        _id: { $nin: serviceIds },
        vehicleCost: id, // TODO: Recheck again
      });

      return true;
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin"]))
  async updateDistanceCost(
    @Arg("id") id: string,
    @Arg("data", () => [DistanceCostPricingInput])
    data: DistanceCostPricingInput[]
  ): Promise<boolean> {
    try {
      await DistanceCostPricingSchema.validate({ distanceCostPricings: data });

      const bulkOps: AnyBulkWriteOperation<DistanceCostPricing>[] = map(
        data,
        ({ _id, ...distance }) => {
          const _oid =
            _id === "-" ? new Types.ObjectId() : new Types.ObjectId(_id);
          return {
            updateOne: {
              filter: { _id: _oid },
              update: { $set: { _id: _oid, ...distance } },
              upsert: true,
            },
          };
        }
      );
      const distanceIds = map(bulkOps, (opt) =>
        get(opt, "updateOne.filter._id", "")
      );

      await DistanceCostPricingModel.bulkWrite(bulkOps);

      await VehicleCostModel.findByIdAndUpdate(id, { distance: distanceIds });

      await DistanceCostPricingModel.deleteMany({
        _id: { $nin: distanceIds },
        vehicleCost: id, // TODO: Recheck again
      });

      return true;
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard(["admin"]))
  async initialVehicleCost(
    @Arg("vehicleTypeId") vehicleTypeId: string,
    @Arg("withAdditionalService", { nullable: true })
    withAdditionalService: boolean = false
  ): Promise<string> {
    try {
      let additionalServicesIds = [];
      if (withAdditionalService) {
        const vehicleType = await VehicleTypeModel.findById(vehicleTypeId);
        const additionalServices = await AdditionalServiceModel.find();
        const additionalServicesFilter = filter(
          additionalServices,
          (service) => {
            if (service.name === "รถขนาดใหญ่") {
              return vehicleType.isLarger;
            }
            return true;
          }
        );
        const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] =
          map(additionalServicesFilter, (service) => {
            const _oid = new Types.ObjectId();
            const type = isEqual(service.name, "ไป-กลับ")
              ? "percent"
              : "currency";
            return {
              updateOne: {
                filter: { _id: _oid },
                update: {
                  $set: {
                    _id: _oid,
                    additionalService: service,
                    available: false,
                    cost: 0,
                    price: 0,
                    type,
                  },
                },
                upsert: true,
              },
            };
          });
        await AdditionalServiceCostPricingModel.bulkWrite(bulkOps);
        additionalServicesIds = map(bulkOps, (opt) =>
          get(opt, "updateOne.filter._id", "")
        );
      }

      const newVehicleCost = new VehicleCostModel({
        vehicleType: vehicleTypeId,
        additionalServices: additionalServicesIds,
        distance: [],
      });
      await newVehicleCost.save();

      return newVehicleCost._id;
    } catch (error) {
      console.log("error: ", error);
      const message = get(error, "message", "");
      throw new GraphQLError(message || "เกิดข้อผิดพลาด โปรดลองอีกครั้ง");
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin"]))
  async initialAdditionalService(
    @Arg("vehicleCostId") vehicleCostId: string
  ): Promise<boolean> {
    try {
      const vehicleCost = await VehicleCostModel.findById(vehicleCostId);
      const vehicleType = get(vehicleCost, "vehicleType", undefined) as
        | VehicleType
        | undefined;

      let additionalServicesIds = [];
      if (vehicleType) {
        const additionalServices = await AdditionalServiceModel.find();
        const additionalServicesFilter = filter(
          additionalServices,
          (service) => {
            if (service.name === "รถขนาดใหญ่") {
              return vehicleType.isLarger;
            }
            return true;
          }
        );
        const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] =
          map(additionalServicesFilter, (service) => {
            const _oid = new Types.ObjectId();
            const type = isEqual(service.name, "ไป-กลับ")
              ? "percent"
              : "currency";
            return {
              updateOne: {
                filter: { _id: _oid },
                update: {
                  $set: {
                    _id: _oid,
                    additionalService: service,
                    available: false,
                    cost: 0,
                    price: 0,
                    type,
                  },
                },
                upsert: true,
              },
            };
          });
        await AdditionalServiceCostPricingModel.bulkWrite(bulkOps);
        additionalServicesIds = map(bulkOps, (opt) =>
          get(opt, "updateOne.filter._id", "")
        );
      }

      await vehicleCost.updateOne({
        additionalServices: additionalServicesIds,
      });

      return true;
    } catch (error) {
      console.log("error: ", error);
      const message = get(error, "message", "");
      throw new GraphQLError(message || "เกิดข้อผิดพลาด โปรดลองอีกครั้ง");
    }
  }
}
