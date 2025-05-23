import { Arg, Resolver, Mutation, UseMiddleware, Query, Args, Ctx } from "type-graphql";
import { AuthGuard } from "@guards/auth.guards";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import { GraphQLError } from "graphql";
import AdditionalServiceModel, {
  AdditionalService,
} from "@models/additionalService.model";
import { AdditionalServiceInput, AdditionalServiceQueryArgs } from "@inputs/additional-service.input";
import { AdditionalServiceSchema } from "@validations/additionalService.validations";
import AdditionalServiceDescriptionModel, {
  AdditionalServiceDescription,
} from "@models/additionalServiceDescription.model";
import { AnyBulkWriteOperation, PaginateOptions, Types, PaginateResult } from "mongoose";
import { get, isArray, map, reduce } from "lodash";
import { PaginationArgs } from "@inputs/query.input";
import { AdditionalServicePaginationPayload } from "@payloads/additionalService.payloads";
import { EUserRole } from "@enums/users";
import RetryTransactionMiddleware from "@middlewares/RetryTransaction";
import { GraphQLContext } from "@configs/graphQL.config";

@Resolver(AdditionalService)
export default class AdditionalServiceResolver {
  @Mutation(() => AdditionalService)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
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
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
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

      // TODO: Recheck
      // await AdditionalServiceDescriptionModel.deleteMany({
      //   _id: { $nin: descriptionIds },
      //   // additionalService: id, // TODO: Recheck again
      // });

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

  @Query(() => AdditionalServicePaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAdditionalServices(
    @Args() { name, ...query }: AdditionalServiceQueryArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs
  ): Promise<AdditionalServicePaginationPayload> {
    try {
      const pagination: PaginateOptions = {
        ...paginationArgs,
        ...(isArray(sortField)
          ? {
            sort: reduce(
              sortField,
              function (result, value) {
                return { ...result, [value]: sortAscending ? 1 : -1 };
              },
              {}
            ),
          }
          : {}),
      };

      const additionalServices = await AdditionalServiceModel.paginate({ ...query, ...(name ? { name: { $regex: name, $options: 'i' } } : {}) }, pagination) as AdditionalServicePaginationPayload
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
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
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
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async getAdditionalServicesByVehicleType(
    @Ctx() ctx: GraphQLContext,
    @Arg("id") id: string
  ): Promise<AdditionalService[]> {
    const session = ctx.session;
    try {
      const additionalServices =
        await AdditionalServiceModel.findByVehicleTypeID(id, session);
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
