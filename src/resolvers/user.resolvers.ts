import {
  Resolver,
  Query,
  Arg,
  Ctx,
  UseMiddleware,
  AuthenticationError,
  Args,
  Mutation,
  InvalidDirectiveError,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import { GetCustomersArgs } from "@inputs/user.input";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { find, get, includes, isArray, isEmpty, isEqual, omit, reduce } from "lodash";
import { UserPaginationAggregatePayload } from "@payloads/user.payloads";
import { PaginateOptions } from "mongoose";
import { PaginationArgs } from "@inputs/query.input";
import { GraphQLError } from "graphql";
import {
  CutomerBusinessInput,
  CutomerIndividualInput,
} from "@inputs/customer.input";
import CustomerIndividualModel from "@models/customerIndividual.model";
import FileModel from "@models/file.model";
import BusinessCustomerModel, { BusinessCustomer } from "@models/customerBusiness.model";
import RegisterResolver from "./register.resolvers";
import BusinessCustomerCreditPaymentModel from "@models/customerBusinessCreditPayment.model";
import { email_sender } from "@utils/email.utils";
import imageToBase64 from "image-to-base64";
import { join } from 'path'
import { SafeString } from 'handlebars'
import { generateRandomNumberPattern } from "@utils/string.utils";
import bcrypt from "bcrypt";
import { GET_USERS } from "@pipelines/user.pipeline";

@Resolver(User)
export default class UserResolver {
  @Query(() => UserPaginationAggregatePayload)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async users(
    @Args() query: GetCustomersArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs
  ): Promise<UserPaginationAggregatePayload> {
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


      const aggregate = UserModel.aggregate(GET_USERS(query))
      const users = (await UserModel.aggregatePaginate(aggregate, pagination)) as UserPaginationAggregatePayload
      // const users = (await UserModel.paginate(
      //   options,
      //   pagination
      // )) as UserPaginationPayload;

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
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data;
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
              ? { businessRegistrationCertificateFile: businessRegistrationCertificate }
              : {}),
            ...(copyIDAuthorizedSignatory
              ? { copyIDAuthorizedSignatoryFile: copyIDAuthorizedSignatory }
              : {}),
            ...(certificateValueAddedTaxRegistration
              ? { certificateValueAddedTaxRegistrationFile: certificateValueAddedTaxRegistration }
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

  @Mutation(() => User)
  @UseMiddleware(AuthGuard(["admin"]))
  async approvalUser(@Arg("id") id: string, @Arg("result") result: TUserValidationStatus, @Ctx() ctx: GraphQLContext): Promise<User> {
    try {
      if (!id) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }
      const customer = await UserModel.findById(id).exec();
      const businessDetail: BusinessCustomer | null = get(customer, 'businessDetail', null)

      if (!customer) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }

      // Check is Business customer?
      if (customer.userType !== 'business') {
        throw new GraphQLError("ประเภทผู้ใช้ไม่สามารถทำรายการได้")
      }
      // Check pending status
      if (customer.validationStatus !== 'pending') {
        throw new GraphQLError("ผู้ใช้ท่านนี้มีการอนุมัติเรียบร้อยแล้ว")
      }
      // Check approval status
      if (!includes(['approve', 'denied'], result)) {
        throw new InvalidDirectiveError('สถานะไม่ถูกต้อง')
      }
      // Check Business Detail
      if (typeof businessDetail !== 'object') {
        throw new InvalidDirectiveError('ไม่พบข้อมูลธุระกิจ')
      }

      // Link
      const protocol = get(ctx, 'req.protocol', '')
      const host = ctx.req.get('host')
      // Prepare email sender
      const emailTranspoter = email_sender();
      // Conver image path to base64 image
      const base64Image = await imageToBase64(join(__dirname, '..', 'assets', 'email_logo.png'))
      const imageUrl = new SafeString(`data:image/png;base64,${base64Image}`)
      const status = result === 'approve' ? 'active' : 'denied'
      // Title name
      const BUSINESS_TITLE_NAME_OPTIONS = [
        { value: 'Co', label: 'บจก.' },
        { value: 'Part', label: 'หจก.' },
        { value: 'Pub', label: 'บมจ.' },
      ]
      const businessTitleName = find(BUSINESS_TITLE_NAME_OPTIONS, ['value', businessDetail.businessTitle])

      if (result === 'approve') {
        const rawPassword = generateRandomNumberPattern("MMPWD########").toLowerCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Update user
        await customer.updateOne({ status, validationStatus: result, password: hashedPassword })

        const activate_link = `${protocol}://${host}/v1/customer/activate/${customer.userNumber}`
        await emailTranspoter.sendMail({
          from: process.env.GOOGLE_MAIL,
          to: businessDetail.businessEmail,
          subject: "บัญชี Movemate ของท่านได้รับการอนุมัติ",
          template: "register_business",
          context: {
            business_title: get(businessTitleName, 'label', ''),
            business_name: businessDetail.businessName,
            username: customer.username,
            password: rawPassword,
            logo: imageUrl,
            activate_link,
            movemate_link: `https://www.movemateth.com`,
          },
        });
      } else {
        // Update user
        await customer.updateOne({ status, validationStatus: result })
        await emailTranspoter.sendMail({
          from: process.env.GOOGLE_MAIL,
          to: businessDetail.businessEmail,
          subject: "บัญชี Movemate ของท่านไม่ได้รับการอนุมัติ",
          template: "register_rejected_account",
          context: {
            business_title: get(businessTitleName, 'label', ''),
            business_name: businessDetail.businessName,
            logo: imageUrl,
            movemate_link: `https://www.movemateth.com`,
          },
        });
      }

      return customer;
    } catch (error) {
      throw error;
    }
  }
}
