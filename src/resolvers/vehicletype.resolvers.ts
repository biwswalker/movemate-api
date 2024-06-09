import {
    Arg,
    Resolver,
    Mutation,
    UseMiddleware,
    Query,
} from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import VehicleTypeModel, { VehicleType } from "@models/vehicleType.model";
import { VehicleTypeInput } from "@inputs/vehicle-type.input";
import { VehicleTypeSchema } from "@validations/vehicletype.validations";
import FileModel from "@models/file.model";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import { GraphQLError } from "graphql";
import { PipelineStage } from "mongoose";
import { VehicleTypeConfigureStatusPayload } from "@payloads/vehicleType.payloads";

@Resolver(VehicleType)
export default class VehicleTypeResolver {

    @Mutation(() => VehicleType)
    @UseMiddleware(AuthGuard(['admin']))
    async addVehicleType(
        @Arg("data") data: VehicleTypeInput,
    ): Promise<VehicleType> {
        const { image, ...values } = data;
        try {
            await VehicleTypeSchema().validate(data, { abortEarly: false })

            const imageModel = new FileModel(image)
            await imageModel.save()

            const vehicleTypeModel = new VehicleTypeModel({
                ...values,
                image: imageModel
            })
            await vehicleTypeModel.save()

            return vehicleTypeModel
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }
    @Mutation(() => VehicleType)
    @UseMiddleware(AuthGuard(['admin']))
    async updateVehicleType(
        @Arg("id") id: string,
        @Arg("data") data: VehicleTypeInput,
    ): Promise<VehicleType> {
        const { image, ...values } = data;
        try {
            await VehicleTypeSchema(true).validate(data, { abortEarly: false })

            const imageModel = image ? new FileModel(image) : null;
            if (imageModel) {
                await imageModel.save();
            }

            await VehicleTypeModel.findByIdAndUpdate(id, {
                ...values,
                ...(imageModel ? { image: imageModel } : {}),
            })

            const vehicleType = await VehicleTypeModel.findById(id)

            return vehicleType
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }
    @Query(() => [VehicleType])
    @UseMiddleware(AuthGuard(["admin"]))
    async getVehicleTypes(): Promise<VehicleType[]> {
        try {
            const vehicleTypes = await VehicleTypeModel.find();
            if (!vehicleTypes) {
                const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return vehicleTypes;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
        }
    }
    @Query(() => VehicleType)
    @UseMiddleware(AuthGuard(["admin"]))
    async getVehicleType(@Arg("name") name: string): Promise<VehicleType> {
        try {
            const vehicleType = await VehicleTypeModel.findOne({ name });
            if (!vehicleType) {
                const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return vehicleType;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
        }
    }
    @Query(() => [VehicleTypeConfigureStatusPayload])
    @UseMiddleware(AuthGuard(["admin"]))
    async getVehicleTypeConfigs(): Promise<VehicleTypeConfigureStatusPayload[]> {
        try {
            const aggregate: PipelineStage[] = [
                { $sort: { type: 1 } },
                {
                    $lookup: {
                        from: "vehiclecosts",
                        localField: "_id",
                        foreignField: "vehicleType",
                        as: "vehicleCosts"
                    }
                },
                {
                    $unwind: {
                        path: "$vehicleCosts",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "files",
                        localField: "image",
                        foreignField: "_id",
                        as: "image"
                    }
                },
                {
                    $unwind: {
                        path: "$image",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        isAdditionalServicesConfigured: { $gt: [{ $size: { $ifNull: ["$vehicleCosts.additionalServices", []] } }, 0] },
                        isDistancesConfigured: { $gt: [{ $size: { $ifNull: ["$vehicleCosts.distance", []] } }, 0] }
                    }
                },
                { $addFields: { isConfigured: { $or: ["$isAdditionalServicesConfigured", "$isDistancesConfigured"] } } },
                { $project: { vehicleCosts: 0 } },
            ]
            const vehicleTypes = await VehicleTypeModel.aggregate(aggregate)
            if (!vehicleTypes) {
                const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return vehicleTypes;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
        }
    }
}
