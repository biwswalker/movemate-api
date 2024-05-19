import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  AuthenticationError,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import CustomerIndividualModel from "@models/customerIndividual.model";
import BusinessCustomerModel from "@models/customerBusiness.model";
import BusinessCustomerCashPaymentModel from '@models/customerBusinessCashPayment.model'
import BusinessCustomerCreditPaymentModel from '@models/customerBusinessCreditPayment.model'
import { RegisterInput, UpdateUserInput } from "@inputs/user.input";
import bcrypt from "bcrypt";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { get, isEmpty, isEqual } from "lodash";
import { generateId, generateRandomNumberPattern } from "@utils/string.utils";
import { email_sender } from "@utils/email.utils";
import imageToBase64 from 'image-to-base64'
import { join } from 'path'
import { SafeString } from 'handlebars'
import { GraphQLError } from 'graphql'
import FileModel from "@models/file.model";
import { UserPayload } from "@payloads/user.payloads";
import IndividualCustomerModel from "@models/customerIndividual.model";

@Resolver(User)
export default class UserResolver {
  @Query(() => [User])
  @UseMiddleware(AuthGuard)
  async users(): Promise<User[]> {
    try {
      const users = await UserModel.find();
      return users;
    } catch (error) {
      throw new Error("Failed to fetch users");
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard)
  async user(@Arg("id") id: string): Promise<User> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    } catch (error) {
      throw new Error("Failed to fetch user");
    }
  }

  @Query(() => UserPayload)
  @UseMiddleware(AuthGuard)
  async me(@Ctx() ctx: GraphQLContext): Promise<UserPayload> {
    try {
      const userId = ctx.req.user_id;
      if (!userId) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AuthenticationError("ไม่พบผู้ใช้");
      }

      if (user.userType === 'individual') {
        const individualDetail = await IndividualCustomerModel.findByUserNumber(user.userNumber)
        return {
          user,
          individualDetail
        }
      } else if (user.userType === 'business') {
        const businessDetail = await BusinessCustomerModel.findByUserNumber(user.userNumber)
        return {
          user,
          businessDetail
        }
      }
      return {
        user
      };
    } catch (error) {
      throw error
    }
  }


  @Mutation(() => UserPayload)
  async register(
    @Arg("data") data: RegisterInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<UserPayload> {
    const {
      userType,
      password,
      remark,
      acceptPolicyTime,
      acceptPolicyVersion,
      individualDetail,
      businessDetail
    } = data;

    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      // Prepare email sender
      const emailTranspoter = email_sender()

      // Conver image path to base64 image
      const base64Image = await imageToBase64(join(__dirname, '..', 'assets', 'email_logo.png'))
      const imageUrl = new SafeString(`data:image/png;base64,${base64Image}`)

      // Exist email
      const userEmail = isEqual(userType, 'individual') ? get(individualDetail, 'email', '') : isEqual(userType, 'business') ? get(businessDetail, 'businessEmail', '') : ''
      const fieldName = userType === 'individual' ? 'email' : 'businessEmail'
      if (userEmail) {

        const isExistingEmailWithIndividual = await CustomerIndividualModel.findOne({
          email: userEmail,
        });
        if (isExistingEmailWithIndividual) {
          throw new GraphQLError('ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ', {
            extensions: {
              code: 'ERROR_VALIDATION',
              errors: [{ field: fieldName, message: 'ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ' }],
            }
          })
        }

        const isExistingEmailWithBusiness = await BusinessCustomerModel.findOne({
          businessEmail: userEmail,
        });
        if (isExistingEmailWithBusiness) {
          throw new GraphQLError('อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
            extensions: {
              code: 'ERROR_VALIDATION',
              errors: [{ field: fieldName, message: 'อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ' }],
            }
          })
        }
      } else {
        throw new GraphQLError('ระบุอีเมล', {
          extensions: {
            code: 'ERROR_VALIDATION',
            errors: [{ field: fieldName, message: 'ระบุอีเมล' }],
          }
        })
      }

      /**
       * Individual Customer Register
       */
      if (userType === "individual" && individualDetail) {
        const isExistingEmail = await CustomerIndividualModel.findOne({
          email: individualDetail.email,
        });
        if (isExistingEmail) {
          throw new Error("อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ");
        }
        const userNumber = await generateId("MMIN", userType);
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new UserModel({
          userNumber,
          userType,
          username: individualDetail.email,
          password: hashedPassword,
          remark,
          registration: platform,
          isVerifiedEmail: false,
          isVerifiedPhoneNumber: false,
          acceptPolicyVersion,
          acceptPolicyTime,
        });
        const individualCustomer = new CustomerIndividualModel({
          userNumber,
          ...individualDetail,
        });

        await user.save();
        await individualCustomer.save();
        // Email sender
        await emailTranspoter.sendMail({
          from: process.env.GOOGLE_MAIL,
          to: individualDetail.email,
          subject: 'ยืนยันการสมัครสมาชิก Movemate!',
          template: 'register_individual',
          context: {
            fullname: individualCustomer.fullName,
            username: individualDetail.email,
            logo: imageUrl,
            activateLink: `https://api.movemateth.com/activate/customer/${userNumber}`,
            movemateLink: `https://www.movemateth.com`,
          }
        })

        return { user, individualDetail: individualCustomer };
      }

      /**
       * Business Customer Register
       */
      if (userType === "business" && businessDetail) {
        if (!businessDetail) {
          throw new Error("ข้อมูลไม่สมบูรณ์");
        }

        const userNumber = await generateId("MMBU", userType);
        const generatedPassword = generateRandomNumberPattern('MM##########').toLowerCase()
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        const user = new UserModel({
          userNumber,
          userType,
          username: userNumber,
          password: hashedPassword,
          remark,
          registration: platform,
          isVerifiedEmail: false,
          isVerifiedPhoneNumber: false,
          acceptPolicyVersion,
          acceptPolicyTime,
        });

        const business = new BusinessCustomerModel({
          ...businessDetail,
          userNumber,
        })

        if (businessDetail.paymentMethod === 'cash' && businessDetail.paymentCashDetail) {
          const cashDetail = businessDetail.paymentCashDetail
          const cashPayment = new BusinessCustomerCashPaymentModel({
            userNumber,
            acceptedEreceiptDate: cashDetail.acceptedEReceiptDate
          })
          await cashPayment.save()
        } else if (businessDetail.paymentMethod === 'credit' && businessDetail.paymentCreditDetail) {
          // TODO: Get default config
          const _defaultCreditLimit = 20000.00
          const _billedDate = 1
          const _billedRound = 15
          const { businessRegistrationCertificateFile, copyIDAuthorizedSignatoryFile, certificateValueAddedTaxRegistrationFile, ...creditDetail } = businessDetail.paymentCreditDetail

          // Upload document
          if (!businessRegistrationCertificateFile) {
            throw new GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
              extensions: {
                code: 'ERROR_VALIDATION',
                errors: [{ field: 'businessRegistrationCertificate', message: 'กรุณาอัพโหลดเอกสารสำเนาบัตรประชาชนผู้มีอำนาจลงนาม' }],
              }
            })
          }
          if (!copyIDAuthorizedSignatoryFile) {
            throw new GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
              extensions: {
                code: 'ERROR_VALIDATION',
                errors: [{ field: 'copyIDAuthorizedSignatory', message: 'กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม' }],
              }
            })
          }
          const businessRegisCertFileModel = new FileModel(businessRegistrationCertificateFile)
          const copyIDAuthSignatoryFileModel = new FileModel(copyIDAuthorizedSignatoryFile)
          const certValueAddedTaxRegisFileModel = certificateValueAddedTaxRegistrationFile ? new FileModel(certificateValueAddedTaxRegistrationFile) : null

          await businessRegisCertFileModel.save()
          await copyIDAuthSignatoryFileModel.save()
          if (certValueAddedTaxRegisFileModel) {
            await certValueAddedTaxRegisFileModel.save()
          }

          const creditPayment = new BusinessCustomerCreditPaymentModel({
            ...creditDetail,
            billedDate: _billedDate,
            billedRound: _billedRound,
            creditLimit: _defaultCreditLimit,
            userNumber,
            creditUsage: 0,
            businessRegistrationCertificateFile: businessRegisCertFileModel,
            copyIDAuthorizedSignatoryFile: copyIDAuthSignatoryFileModel,
            ...(certValueAddedTaxRegisFileModel ? { certificateValueAddedTaxRefistrationFile: certValueAddedTaxRegisFileModel } : {})
          })
          await creditPayment.save()
        } else {
          throw new Error("ไม่พบข้อมูลการชำระ กรุณาติดต่อผู้ดูแลระบบ");
        }

        await business.save()
        await user.save();

        if (businessDetail.paymentMethod === 'cash') {
          // Email sender
          await emailTranspoter.sendMail({
            from: process.env.GOOGLE_MAIL,
            to: businessDetail.businessEmail,
            subject: 'ยืนยันการสมัครสมาชิก Movemate!',
            template: 'register_business',
            context: {
              business_title: businessDetail.businessTitle,
              business_name: businessDetail.businessName,
              username: userNumber,
              password: generatedPassword,
              logo: imageUrl,
              activate_link: `https://api.movemateth.com/activate/customer/${userNumber}`,
              movemate_link: `https://www.movemateth.com`,
            }
          })
        }
        return { user, businessDetail: business };
      }

      return null;
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard)
  async updateUser(
    @Arg("data") { id, ...update_data }: UpdateUserInput
  ): Promise<User> {
    try {
      const user = await UserModel.findByIdAndUpdate(id, update_data, {
        new: true,
      });
      if (!user) {
        throw new Error("User not found");
      }

      return user;
    } catch (error) {
      throw new Error("Failed to update user");
    }
  }
}
