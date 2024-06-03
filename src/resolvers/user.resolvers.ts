import {
  Resolver,
  Query,
  Arg,
  Ctx,
  UseMiddleware,
  AuthenticationError,
  Args,
  Mutation,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import { GetCustomersArgs } from "@inputs/user.input";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { get, isArray, isEmpty, isEqual, omit, reduce } from "lodash";
import { UserPaginationPayload } from "@payloads/user.payloads";
import { FilterQuery, PaginateOptions } from "mongoose";
import { PaginationArgs } from "@inputs/query.input";
import { GraphQLError } from "graphql";
import {
  CutomerBusinessInput,
  CutomerIndividualInput,
} from "@inputs/customer.input";
import CustomerIndividualModel from "@models/customerIndividual.model";
import FileModel from "@models/file.model";
import BusinessCustomerModel from "@models/customerBusiness.model";
import RegisterResolver from "./register.resolvers";
import BusinessCustomerCreditPaymentModel from "@models/customerBusinessCreditPayment.model";

@Resolver(User)
export default class UserResolver {
  @Query(() => UserPaginationPayload)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async users(
    @Args() query: GetCustomersArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs
  ): Promise<UserPaginationPayload> {
    try {
      const options: FilterQuery<typeof User> = {
        ...query,
      };

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

      const users = (await UserModel.paginate(
        options,
        pagination
      )) as UserPaginationPayload;

      return users;
    } catch (error) {
      console.log(error);
      throw new GraphQLError("ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง");
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async getUserByUsername(@Arg("username") username: string): Promise<User> {
    try {
      const user = await UserModel.findByUsername(username);
      if (!user) {
        const message = `ไม่พบผู้ใช้ ${username}`;
        throw new GraphQLError(message, {
          extensions: { code: "NOT_FOUND", errors: [{ message }] },
        });
      }
      return user;
    } catch (error) {
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง");
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async me(@Ctx() ctx: GraphQLContext): Promise<User> {
    try {
      const userId = ctx.req.user_id;
      if (!userId) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard(["admin"]))
  async updateIndividualCustomer(
    @Arg("id") id: string,
    @Arg("data") data: CutomerIndividualInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<User> {
    const { email, profileImage, ...formValue } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      if (id) {
        const userModel = await UserModel.findById(id);
        if (!userModel) {
          const message =
            "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, {
            extensions: {
              code: "NOT_FOUND",
              errors: [{ message }],
            },
          });
        }

        const customerIndividualModel = await CustomerIndividualModel.findById(
          userModel.individualDetail
        );
        if (!customerIndividualModel) {
          const message =
            "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, {
            extensions: {
              code: "NOT_FOUND",
              errors: [{ message }],
            },
          });
        }

        const uploadedImage = profileImage ? new FileModel(profileImage) : null;
        if (uploadedImage) {
          await uploadedImage.save();
        }

        await userModel.updateOne({
          ...formValue,
          username: email,
          ...(uploadedImage ? { profileImage: uploadedImage } : {}),
        });
        await customerIndividualModel.updateOne({ ...formValue });

        const user = await UserModel.findById(id);
        return user;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard(["admin"]))
  async updateBusinessCustomer(
    @Arg("id") id: string,
    @Arg("data") data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<User> {
    const { businessEmail, profileImage, creditPayment, ...formValue } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      if (id) {
        const userModel = await UserModel.findById(id);
        if (!userModel) {
          const message =
            "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, {
            extensions: {
              code: "NOT_FOUND",
              errors: [{ message }],
            },
          });
        }

        const customerBusinesslModel = await BusinessCustomerModel.findById(
          userModel.businessDetail
        );
        if (!customerBusinesslModel) {
          const message =
            "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, {
            extensions: {
              code: "NOT_FOUND",
              errors: [{ message }],
            },
          });
        }

        // Check existing email; If user has changed email
        if (!isEqual(customerBusinesslModel.businessEmail, businessEmail)) {
          await new RegisterResolver().isExistingEmail(
            businessEmail,
            "businessEmail"
          );
        }

        // Profil Image
        const uploadedImage = profileImage ? new FileModel(profileImage) : null;
        if (uploadedImage) {
          await uploadedImage.save();
        }

        if (formValue.paymentMethod === "credit" && creditPayment) {
          const creditDetail =
            await BusinessCustomerCreditPaymentModel.findById(
              customerBusinesslModel.creditPayment
            );
          if (!creditDetail) {
            const message =
              "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบข้อมูลการเงิน";
            throw new GraphQLError(message, {
              extensions: {
                code: "NOT_FOUND",
                errors: [{ message }],
              },
            });
          }

          const businessRegistrationCertificateFile = get(creditPayment, 'businessRegistrationCertificateFile', null)
          const copyIDAuthorizedSignatoryFile = get(creditPayment, 'copyIDAuthorizedSignatoryFile', null)
          const certificateValueAddedTaxRegistrationFile = get(creditPayment, 'certificateValueAddedTaxRegistrationFile', null)

          // Document Image 1
          const businessRegistrationCertificate =
            businessRegistrationCertificateFile
              ? new FileModel(businessRegistrationCertificateFile)
              : null;
          if (businessRegistrationCertificate) {
            await businessRegistrationCertificate.save();
          }
          // Document Image 2
          const copyIDAuthorizedSignatory = copyIDAuthorizedSignatoryFile
            ? new FileModel(copyIDAuthorizedSignatoryFile)
            : null;
          if (copyIDAuthorizedSignatory) {
            await copyIDAuthorizedSignatory.save();
          }
          // Document Image 3
          const certificateValueAddedTaxRegistration =
            certificateValueAddedTaxRegistrationFile
              ? new FileModel(certificateValueAddedTaxRegistrationFile)
              : null;
          if (certificateValueAddedTaxRegistration) {
            await certificateValueAddedTaxRegistration.save();
          }

          await creditDetail.updateOne({
            ...omit(creditPayment, ['businessRegistrationCertificateFile', 'copyIDAuthorizedSignatoryFile', 'certificateValueAddedTaxRegistrationFile']),
            ...(businessRegistrationCertificate
              ? { profileImage: businessRegistrationCertificate }
              : {}),
            ...(copyIDAuthorizedSignatory
              ? { profileImage: copyIDAuthorizedSignatory }
              : {}),
            ...(certificateValueAddedTaxRegistration
              ? { profileImage: certificateValueAddedTaxRegistration }
              : {}),
          });
        }

        await userModel.updateOne({
          ...formValue,
          ...(uploadedImage ? { profileImage: uploadedImage } : {}),
        });

        await customerBusinesslModel.updateOne({ ...formValue, businessEmail });

        const user = await UserModel.findById(id);
        return user;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
