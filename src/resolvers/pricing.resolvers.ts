import {
    Arg,
    Resolver,
    UseMiddleware,
    Query,
    Mutation,
    ID,
} from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import VehicleTypeModel from "@models/vehicleType.model";
import { GraphQLError } from "graphql";
import VehicleCostModel, { VehicleCost } from "@models/vehicleCost.model";
import { GET_VEHICLE_COST } from "@pipelines/pricing.pipeline";
import { AdditionalServiceCostInput } from "@inputs/vehicle-cost.input";
import { AdditionalServiceCostSchema } from "@validations/vehiclecost.validations";
import AdditionalServiceCostPricingModel, { AdditionalServiceCostPricing } from "@models/additionalServiceCostPricing.model";
import { get, map } from "lodash";
import { AnyBulkWriteOperation, Types } from "mongoose";

@Resolver()
export default class PricingResolver {

    @Query(() => VehicleCost)
    @UseMiddleware(AuthGuard(["admin"]))
    async getVehicleCost(@Arg("vehicleTypeId") vehicleTypeId: string): Promise<VehicleCost> {
        try {

            const vehicleCost = await VehicleCostModel.aggregate(GET_VEHICLE_COST(vehicleTypeId))
            if (!vehicleCost || !vehicleCost[0]) {
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
                })

                return vehicleCostTemporary
            }
            return vehicleCost[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(["admin"]))
    async updateAdditionalServiceCost(@Arg("id") id: string, @Arg("data", () => [AdditionalServiceCostInput]) data: AdditionalServiceCostInput[]): Promise<boolean> {
        try {
            await AdditionalServiceCostSchema.validate({ additionalServices: data })

            const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] = map(data, ({ _id, ...service }) => {
                const _oid = _id === '-' ? new Types.ObjectId() : new Types.ObjectId(_id)
                return {
                    updateOne: {
                        filter: { _id: _oid },
                        update: { $set: { _id: _oid, ...service } },
                        upsert: true,
                    }
                }
            });
            const serviceIds = map(bulkOps, (opt) => get(opt, 'updateOne.filter._id', ''))

            await AdditionalServiceCostPricingModel.bulkWrite(bulkOps)

            await VehicleCostModel.findByIdAndUpdate(id, { additionalServices: serviceIds })

            await AdditionalServiceCostPricingModel.deleteMany({
                _id: { $nin: serviceIds },
                vehicleCost: id
            })

            return true
        } catch (error) {
            console.log('error: ', error)
            const message = get(error, 'message', '')
            throw new GraphQLError(message || "เกิดข้อผิดพลาด โปรดลองอีกครั้ง");
        }
    }
}
