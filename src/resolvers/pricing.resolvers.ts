import {
    Arg,
    Resolver,
    UseMiddleware,
    Query,
} from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import VehicleTypeModel from "@models/vehicleType.model";
import { GraphQLError } from "graphql";
import VehicleCostModel, { VehicleCost } from "@models/vehicleCost.model";

@Resolver()
export default class PricingResolver {

    @Query(() => VehicleCost)
    @UseMiddleware(AuthGuard(["admin"]))
    async getVehicleCost(@Arg("vehicleTypeId") vehicleTypeId: string): Promise<VehicleCost> {
        try {
            const vehicleCost = await VehicleCostModel.findOne({ vehicleType: vehicleTypeId })
                .populate({
                    path: 'additionalServices',
                    populate: {
                        path: 'additionalService',
                        populate: {
                            path: 'descriptions',
                            populate: {
                                path: 'vehicleTypes',
                                model: 'VehicleType'
                            }
                        },
                    },
                })
            if (!vehicleCost) {
                const vehicleType = await VehicleTypeModel.findById(vehicleTypeId);
                console.log('vehicleType: ', vehicleType)

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

            console.log('vehicleCost: ', JSON.stringify(vehicleCost))

            return vehicleCost[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
        }
    }
}
