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
import { find, get, includes, isArray, isEmpty, isEqual, map, omit, omitBy, reduce } from "lodash";
import { RequireDataBeforePayload, UserPaginationAggregatePayload } from "@payloads/user.payloads";
import { PaginateOptions } from "mongoose";
import { PaginationArgs } from "@inputs/query.input";
import { GraphQLError } from "graphql";
import {
  AcceptedPolicyInput,
  CutomerBusinessInput,
  CutomerIndividualInput,
  ResetPasswordInput,
} from "@inputs/customer.input";
import CustomerIndividualModel, { IndividualCustomer } from "@models/customerIndividual.model";
import FileModel from "@models/file.model";
import BusinessCustomerModel, { BusinessCustomer } from "@models/customerBusiness.model";
import BusinessCustomerCreditPaymentModel from "@models/customerBusinessCreditPayment.model";
import { email_sender } from "@utils/email.utils";
import imageToBase64 from "image-to-base64";
import { join } from 'path'
import { SafeString } from 'handlebars'
import { generateId, generateOTP, generateRandomNumberPattern, getCurrentHost } from "@utils/string.utils";
import bcrypt from "bcrypt";
import { GET_USERS } from "@pipelines/user.pipeline";
import { BusinessCustomerSchema, IndividualCustomerSchema } from "@validations/customer.validations";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import BusinessCustomerCashPaymentModel from "@models/customerBusinessCashPayment.model";
import SettingCustomerPoliciesModel from "@models/settingCustomerPolicies.model";
import SettingDriverPoliciesModel from "@models/settingDriverPolicies.model";
import { VerifyPayload } from "@payloads/verify.payloads";
import { addMinutes, addSeconds } from "date-fns";
import { decryption } from "@utils/encryption";

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

      const filterQuery = omitBy(query, isEmpty)
      const aggregate = UserModel.aggregate(GET_USERS(filterQuery))
      const users = (await UserModel.aggregatePaginate(aggregate, pagination)) as UserPaginationAggregatePayload

      return users;
    } catch (error) {
      console.log(error);
      throw new GraphQLError("ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง");
    }
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard(["admin"]))
  async alluserIds(@Args() query: GetCustomersArgs): Promise<string[]> {
    try {
      const filterQuery = omitBy(query, isEmpty)
      const users = (await UserModel.aggregate(GET_USERS(filterQuery)))
      const ids = map(users, ({ _id }) => _id)
      console.log('users: ', ids)

      return ids;
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

  @Query(() => RequireDataBeforePayload)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async requireBeforeSignin(@Ctx() ctx: GraphQLContext): Promise<RequireDataBeforePayload> {
    try {
      const userId = ctx.req.user_id;
      if (!userId) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }

      // Check policy
      let requireAcceptedPolicy = true
      if (user.userRole === 'customer') {
        const settingCustomerPolicies = await SettingCustomerPoliciesModel.find();
        const policyVersion = get(settingCustomerPolicies, '0.version', 0)
        if (user.acceptPolicyVersion >= policyVersion) {
          requireAcceptedPolicy = false
        } else {
          requireAcceptedPolicy = true
        }
      } else if (user.userRole === 'driver') {
        const settingDriverPolicies = await SettingDriverPoliciesModel.find();
        const policyVersion = get(settingDriverPolicies, '0.version', 0)
        if (user.acceptPolicyVersion >= policyVersion) {
          requireAcceptedPolicy = false
        } else {
          requireAcceptedPolicy = true
        }
      }

      return {
        requireAcceptedPolicy,
        requirePasswordChange: user.isChangePasswordRequire
      };
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin", "customer"]))
  async updateIndividualCustomer(
    @Arg("id") id: string,
    @Arg("data") data: CutomerIndividualInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    const { email, profileImage, ...formValue } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      if (id) {
        await IndividualCustomerSchema(id).validate(data, { abortEarly: false })
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

        return true;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin", 'customer']))
  async updateBusinessCustomer(
    @Arg("id") id: string,
    @Arg("data") data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      if (id) {
        await BusinessCustomerSchema(id).validate(data, { abortEarly: false })

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

        return true;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
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
      const individualDetail: IndividualCustomer | null = get(customer, 'individualDetail', null)
      const businessDetail: BusinessCustomer | null = get(customer, 'businessDetail', null)
      const upgradeRequest: BusinessCustomer | null = get(customer, 'upgradeRequest', null)
      const businesData: BusinessCustomer | null = customer.userType === 'individual' ? upgradeRequest : businessDetail

      if (!customer) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
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
      if (typeof businesData !== 'object') {
        throw new InvalidDirectiveError('ไม่พบข้อมูลธุระกิจ')
      }

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

      const businessTitleName = find(BUSINESS_TITLE_NAME_OPTIONS, ['value', businesData.businessTitle])

      if (result === 'approve') {
        const rawPassword = generateRandomNumberPattern("MMPWD########").toLowerCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        if (customer.userType === 'individual') {
          const userNumber = await generateId("MMBU", 'business');
          const newBusinessDetail = {
            userNumber,
            username: userNumber,
            userType: 'business',
            businessDetail: businesData,
            upgradeRequest: null,
            isChangePasswordRequire: true,
          }
          await customer.updateOne({ status, validationStatus: result, password: hashedPassword, ...newBusinessDetail })
          const movemate_link = `https://www.movematethailand.com`
          await emailTranspoter.sendMail({
            from: process.env.NOREPLY_EMAIL,
            to: businesData.businessEmail,
            subject: "บัญชี Movemate ของท่านได้รับการอนุมัติ",
            template: "register_business_upgrade",
            context: {
              business_title: get(businessTitleName, 'label', ''),
              business_name: businesData.businessName,
              username: userNumber,
              password: rawPassword,
              logo: imageUrl,
              movemate_link,
            },
          });
        } else {
          await customer.updateOne({ status, validationStatus: result, password: hashedPassword })
          const host = getCurrentHost(ctx)
          const activate_link = `${host}/api/v1/activate/customer/${customer.userNumber}`
          const movemate_link = `https://www.movematethailand.com`
          await emailTranspoter.sendMail({
            from: process.env.NOREPLY_EMAIL,
            to: businesData.businessEmail,
            subject: "บัญชี Movemate ของท่านได้รับการอนุมัติ",
            template: "register_business",
            context: {
              business_title: get(businessTitleName, 'label', ''),
              business_name: businesData.businessName,
              username: customer.username,
              password: rawPassword,
              logo: imageUrl,
              activate_link,
              movemate_link,
            },
          });
        }
      } else {
        // Update user
        const newBusinessDetail = customer.userType === 'individual' ? {
          upgradeRequest: null,
          validationStatus: 'pending',
          status: 'active'
        } : {}

        const sentemail = customer.userType === 'individual' ? individualDetail.email : businesData.businessEmail

        await customer.updateOne({ status, validationStatus: result, ...newBusinessDetail })
        await emailTranspoter.sendMail({
          from: process.env.NOREPLY_EMAIL,
          to: sentemail,
          subject: "บัญชี Movemate ของท่านไม่ได้รับการอนุมัติ",
          template: "register_rejected_account",
          context: {
            business_title: get(businessTitleName, 'label', ''),
            business_name: businesData.businessName,
            logo: imageUrl,
            movemate_link: `https://www.movematethailand.com`,
          },
        });
      }
      // TODO: Add Notification for result

      return customer;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["admin", 'customer']))
  async upgradeAccount(
    @Arg("id") id: string,
    @Arg("data") data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      if (id) {
        await BusinessCustomerSchema(id).validate(data, { abortEarly: false })

        const userModel = await UserModel.findById(id);
        if (!userModel) {
          const message =
            "ไม่สามารถอัพเกรดได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, {
            extensions: {
              code: "NOT_FOUND",
              errors: [{ message }],
            },
          });
        }

        if (userModel.userType === 'business' || userModel.businessDetail) {
          const message =
            "ไม่สามารถอัพเกรดได้ เนื่องจากเป็นสมาชิกรูปแบบ Business อยู่แล้ว";
          throw new GraphQLError(message);
        }

        if (userModel.upgradeRequest) {
          const message =
            "ไม่สามารถอัพเกรดได้ เนื่องจากมีคำขอก่อนหน้านี้แล้ว";
          throw new GraphQLError(message);
        }

        const userNumber = await generateId("MMBU", "business");

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

        const cashPaymentDetail =
          (formValue.paymentMethod === 'credit' && cashPayment)
            ? new BusinessCustomerCashPaymentModel({
              acceptedEreceiptDate: cashPayment.acceptedEReceiptDate,
            })
            : null;
        if (cashPaymentDetail) {
          await cashPaymentDetail.save()
        }

        const creditPaymentDetail =
          (formValue.paymentMethod === 'credit' && creditPayment)
            ? new BusinessCustomerCreditPaymentModel({
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
            })
            : null;
        if (creditPaymentDetail) {
          await creditPaymentDetail.save()
        }

        const customer = new BusinessCustomerModel({
          userNumber,
          businessEmail,
          ...formValue,
          ...(cashPaymentDetail ? { cashPayment: cashPaymentDetail } : {}),
          ...(creditPaymentDetail ? { creditPayment: creditPaymentDetail } : {})
        });

        await customer.save();

        await userModel.updateOne({
          validationStatus: 'pending',
          upgradeRequest: customer
        });

        return true;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(["customer"]))
  async acceptedPolicy(
    @Arg("data") data: AcceptedPolicyInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    try {
      const userId = ctx.req.user_id;
      if (userId) {
        if (data.version <= 0) {
          const message =
            "ข้อมูลไม่ครบ โปรลองอีกครั้ง";
          throw new GraphQLError(message);
        }

        const userModel = await UserModel.findById(userId);
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

        await userModel.updateOne({ acceptPolicyVersion: data.version, acceptPolicyTime: new Date() })
        return true;
      }
      const message =
        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }

  @Mutation(() => VerifyPayload)
  async forgotPassword(@Arg("email") email: string): Promise<VerifyPayload> {
    try {
      if (email) {
        const user = await UserModel.findCustomerByEmail(email)
        if (!user) {
          const message = "ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
          throw new GraphQLError(message, { extensions: { code: "NOT_FOUND", errors: [{ message }] } });
        }

        const emailTranspoter = email_sender();
        const code = generateOTP()

        const currentDate = new Date()
        const resend_countdown = addSeconds(currentDate, 45)
        const reset_time = addMinutes(currentDate, 30)

        await UserModel.findByIdAndUpdate(user._id, { resetPasswordCode: code, lastestResetPassword: reset_time })
        const movemate_link = `https://www.movematethailand.com`
        await emailTranspoter.sendMail({
          from: process.env.NOREPLY_EMAIL,
          to: email,
          subject: "ยืนยันตัวตนคุณ",
          template: "forgot_password",
          context: {
            code,
            movemate_link,
          },
        });
        return {
          countdown: resend_countdown,
          duration: '45s',
        }
      }
      const message =
        "ไม่สามารถรีเซ็ทรหัสผ่านได้ เนื่องจากไม่พบอีเมลผู้ใช้งาน";
      throw new GraphQLError(message, {
        extensions: {
          code: "NOT_FOUND",
          errors: [{ message }],
        },
      });
    } catch (errors) {
      console.log("error: ", errors);
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors);
      }
      throw errors;
    }
  }

  @Mutation(() => Boolean)
  async verifyResetPassword(@Args() data: ResetPasswordInput): Promise<boolean> {
    try {
      const user = await UserModel.findCustomerByEmail(data.email)
      if (!user) {
        const message =
          "ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
        throw new GraphQLError(message, {
          extensions: {
            code: "NOT_FOUND",
            errors: [{ message }],
          },
        });
      }
      // Prepare Email
      const emailTranspoter = email_sender();
      // TODO: Verify time range

      // Verify code
      if (!isEmpty(user.resetPasswordCode) && isEqual(data.code, user.resetPasswordCode)) {
        // Decryption password from frontend
        const password_decryption = decryption(data.password)
        const hashedPassword = await bcrypt.hash(password_decryption, 10);
        // Save password and return
        await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword, resetPasswordCode: null })
        // Email sender
        const movemate_link = `https://www.movematethailand.com`
        await emailTranspoter.sendMail({
          from: process.env.NOREPLY_EMAIL,
          to: data.email,
          subject: "เปลี่ยนรหัสผ่านบัญชีสำเร็จ",
          template: "passwordchanged",
          context: { movemate_link },
        });
        return true
      }
      const message = "รหัสไม่ถูกต้อง";
      throw new GraphQLError(message, { extensions: { code: "NOT_MATCH", errors: [{ message }] } });

    } catch (error) {
      throw error;
    }
  }
}
