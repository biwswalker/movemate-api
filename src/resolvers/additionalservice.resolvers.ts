import {
    Arg,
    Resolver,
    Mutation,
    UseMiddleware,
} from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import { GraphQLError } from "graphql";
import AdditionalServiceModel, { AdditionalService } from "@models/additionalService.model";
import { AdditionalServiceInput } from "@inputs/additional-service.input";
import { map } from "lodash";
import { Types } from "mongoose";

@Resolver(AdditionalService)
export default class AdditionalServiceResolver {

    @Mutation(() => AdditionalService)
    @UseMiddleware(AuthGuard(['admin']))
    async addAdditionalService(
        @Arg("data") data: AdditionalServiceInput,
    ): Promise<AdditionalService> {
        const { descriptions, ...values } = data;
        try {
            console.log('req data: ', data)
            // await VehicleTypeSchema().validate(data, { abortEarly: false })

            const vehicleTypeModel = new AdditionalServiceModel({
                ...values,
                descriptions: map(descriptions, (description) => {
                    const vehicleTypes = map(description.vehicleTypes, id => new Types.ObjectId(id))
                    return {
                        ...description,
                        vehicleTypes
                    }
                })
            })
            await vehicleTypeModel.save()

            const result = await AdditionalServiceModel.findById(vehicleTypeModel._id)

            return result
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }
    // @Mutation(() => VehicleType)
    // @UseMiddleware(AuthGuard(['admin']))
    // async updateVehicleType(
    //     @Arg("id") id: string,
    //     @Arg("data") data: VehicleTypeInput,
    // ): Promise<VehicleType> {
    //     const { image, ...values } = data;
    //     try {
    //         await VehicleTypeSchema(true).validate(data, { abortEarly: false })

    //         const imageModel = image ? new FileModel(image) : null;
    //         if (imageModel) {
    //             await imageModel.save();
    //         }

    //         await VehicleTypeModel.findByIdAndUpdate(id, {
    //             ...values,
    //             ...(imageModel ? { image: imageModel } : {}),
    //         })

    //         const vehicleType = await VehicleTypeModel.findById(id)

    //         return vehicleType
    //     } catch (errors) {
    //         console.log('error: ', errors)
    //         if (errors instanceof ValidationError) {
    //             throw yupValidationThrow(errors)
    //         }
    //         throw errors
    //     }
    // }
    // @Query(() => [VehicleType])
    // @UseMiddleware(AuthGuard(["admin"]))
    // async getVehicleTypes(): Promise<VehicleType[]> {
    //     try {
    //         const vehicleTypes = await VehicleTypeModel.find();
    //         if (!vehicleTypes) {
    //             const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
    //             throw new GraphQLError(message, {
    //                 extensions: { code: "NOT_FOUND", errors: [{ message }] },
    //             });
    //         }
    //         return vehicleTypes;
    //     } catch (error) {
    //         console.log('error: ', error)
    //         throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    //     }
    // }
    // @Query(() => VehicleType)
    // @UseMiddleware(AuthGuard(["admin"]))
    // async getVehicleType(@Arg("name") name: string): Promise<VehicleType> {
    //     try {
    //         const vehicleType = await VehicleTypeModel.findOne({ name });
    //         if (!vehicleType) {
    //             const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
    //             throw new GraphQLError(message, {
    //                 extensions: { code: "NOT_FOUND", errors: [{ message }] },
    //             });
    //         }
    //         return vehicleType;
    //     } catch (error) {
    //         console.log('error: ', error)
    //         throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    //     }
    // }
}
