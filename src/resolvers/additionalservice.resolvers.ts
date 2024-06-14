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
import AdditionalServiceDescriptionModel, {
  AdditionalServiceDescription,
} from "@models/additionalServiceDescription.model";
import { AnyBulkWriteOperation, Types } from "mongoose";
import { get, map } from "lodash";

@Resolver(AdditionalService)
export default class AdditionalServiceResolver {
  @Mutation(() => AdditionalService)
  @UseMiddleware(AuthGuard(["admin"]))
  async addAdditionalService(
    @Arg("data") data: AdditionalServiceInput
  ): Promise<AdditionalService> {
    const { descriptions, ...values } = data;
    try {
      await AdditionalServiceSchema().validate(data, { abortEarly: false });

      const bulkOps: AnyBulkWriteOperation<AdditionalServiceDescription>[] =
        map(descriptions, ({ _id, ...description }) => {
          const _oid =
            _id === "-" ? new Types.ObjectId() : new Types.ObjectId(_id);
          return {
            updateOne: {
              filter: { _id: _oid },
              update: { $set: { _id: _oid, ...description } },
              upsert: true,
            },
          };
        });
      const descriptionIds = map(bulkOps, (opt) =>
        get(opt, "updateOne.filter._id", "")
      );

      await AdditionalServiceDescriptionModel.bulkWrite(bulkOps);

      const additionalModel = new AdditionalServiceModel({
        ...values,
        descriptions: descriptionIds,
      });
      await additionalModel.save();

      const result = await AdditionalServiceModel.findById(additionalModel._id);

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
  @UseMiddleware(AuthGuard(["admin"]))
  async updateAdditionalService(
    @Arg("id") id: string,
    @Arg("data") data: AdditionalServiceInput
  ): Promise<AdditionalService> {
    const { descriptions, ...values } = data;
    try {
      await AdditionalServiceSchema(true).validate(data, { abortEarly: false });

      const bulkOps: AnyBulkWriteOperation<AdditionalServiceDescription>[] =
        map(descriptions, ({ _id, ...description }) => {
          const _oid =
            _id === "-" ? new Types.ObjectId() : new Types.ObjectId(_id);
          return {
            updateOne: {
              filter: { _id: _oid },
              update: { $set: { _id: _oid, ...description } },
              upsert: true,
            },
          };
        });
      const descriptionIds = map(bulkOps, (opt) =>
        get(opt, "updateOne.filter._id", "")
      );

      await AdditionalServiceDescriptionModel.bulkWrite(bulkOps);

      await AdditionalServiceModel.findByIdAndUpdate(id, {
        ...values,
        descriptions: descriptionIds,
      });

      await AdditionalServiceDescriptionModel.deleteMany({
        _id: { $nin: descriptionIds },
        additionalService: id, // TODO: Recheck again
      });

      const additionalService = await AdditionalServiceModel.findById(id);

      return additionalService;
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }
  @Query(() => [AdditionalService])
  @UseMiddleware(AuthGuard(["admin"]))
  async getAdditionalServices(): Promise<AdditionalService[]> {
    try {
      const additionalServices = await AdditionalServiceModel.find().sort({
        permanent: -1,
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
  async getAdditionalService(
    @Arg("name") name: string
  ): Promise<AdditionalService> {
    try {
      const additionalService = await AdditionalServiceModel.findOne({ name });
      if (!additionalService) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`;
        throw new GraphQLError(message, {
          extensions: { code: "NOT_FOUND", errors: [{ message }] },
        });
      }
      return additionalService;
    } catch (error) {
      console.log("error: ", error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง");
    }
  }
  @Query(() => [AdditionalService])
  @UseMiddleware(AuthGuard(["admin"]))
  async getAdditionalServicesByVehicleType(
    @Arg("id") id: string
  ): Promise<AdditionalService[]> {
    try {
      const additionalServices =
        await AdditionalServiceModel.findByVehicleTypeID(id);
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
}
