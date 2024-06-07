import { Arg, Resolver, Mutation, UseMiddleware, Query } from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import { GraphQLError } from "graphql";
import AdditionalServiceModel, {
  AdditionalService,
} from "@models/additionalService.model";
import { AdditionalServiceInput } from "@inputs/additional-service.input";
import { AdditionalServiceSchema } from "@validations/additionalService.validations";

@Resolver(AdditionalService)
export default class AdditionalServiceResolver {
  @Mutation(() => AdditionalService)
  @UseMiddleware(AuthGuard(["admin"]))
  async addAdditionalService(
    @Arg("data") data: AdditionalServiceInput
  ): Promise<AdditionalService> {
    const { descriptions, ...values } = data;
    try {
      await AdditionalServiceSchema().validate(data, { abortEarly: false })

      const additionalModel = new AdditionalServiceModel(data);
      await additionalModel.save();

      const result = await AdditionalServiceModel
        .findById(additionalModel._id)
        .populate({
          path: 'descriptions',
          populate: {
            path: 'vehicleTypes',
            model: 'VehicleType'
          }
        })

      return result;
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }
  @Mutation(() => AdditionalService)
  @UseMiddleware(AuthGuard(['admin']))
  async updateAdditionalService(
    @Arg("id") id: string,
    @Arg("data") data: AdditionalServiceInput,
  ): Promise<AdditionalService> {
    try {
      await AdditionalServiceSchema(true).validate(data, { abortEarly: false })

      await AdditionalServiceModel.findByIdAndUpdate(id, data)

      const additionalService = await AdditionalServiceModel.findById(id).populate({
        path: 'descriptions',
        populate: {
          path: 'vehicleTypes',
          model: 'VehicleType'
        }
      })

      return additionalService
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
  @Query(() => [AdditionalService])
  @UseMiddleware(AuthGuard(["admin"]))
  async getAdditionalServices(): Promise<AdditionalService[]> {
    try {
      const additionalServices = await AdditionalServiceModel.find().populate({
        path: 'descriptions',
        populate: {
          path: 'vehicleTypes',
          model: 'VehicleType'
        }
      });
      if (!additionalServices) {
        const message = `ไม่สามารถเรียกข้อมูลบริการเสริมได้`;
        throw new GraphQLError(message, {
          extensions: { code: "NOT_FOUND", errors: [{ message }] },
        });
      }
      return additionalServices;
    } catch (error) {
      console.log("error: ", error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    }
  }
  @Query(() => AdditionalService)
  @UseMiddleware(AuthGuard(["admin"]))
  async getAdditionalService(@Arg("name") name: string): Promise<AdditionalService> {
    try {
      const additionalService = await AdditionalServiceModel.findOne({ name }).populate({
        path: 'descriptions',
        populate: {
          path: 'vehicleTypes',
          model: 'VehicleType'
        }
      });
      if (!additionalService) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
        throw new GraphQLError(message, {
          extensions: { code: "NOT_FOUND", errors: [{ message }] },
        });
      }
      return additionalService;
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    }
  }
}
