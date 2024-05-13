import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
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
import { isEmpty } from "lodash";
import { generateId, generateRandomNumberPattern } from "@utils/string.utils";
import { email_sender } from "@utils/email.utils";
import imageToBase64 from 'image-to-base64'
import { join, resolve } from 'path'
import { SafeString } from 'handlebars'

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

  @Query(() => User)
  @UseMiddleware(AuthGuard)
  async me(@Ctx() ctx: GraphQLContext): Promise<User> {
    try {
      const userId = ctx.req.user_id;
      if (!userId) {
        throw new Error("User not found");
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    } catch (error) {
      throw new Error("Failed to fetch user");
    }
  }

  @Mutation(() => User)
  async register(
    @Arg("data") data: RegisterInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<User> {
    const {
      user_type,
      password,
      remark,
      accept_policy_version,
      accept_policy_time,
      individual_detail,
      business_detail,
    } = data;

    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      // Prepare email sender
      const email_transpoter = email_sender()

      // Conver image path to base64 image
      const base64_image = await imageToBase64(join(resolve('.'), 'assets', 'email_logo.png'))
      const image_url = new SafeString(`data:image/png;base64,${base64_image}`)

      /**
       * Individual Customer Register
       */
      if (user_type === "individual" && individual_detail) {
        const is_existing_email = await CustomerIndividualModel.findOne({
          email: individual_detail.email,
        });
        if (is_existing_email) {
          throw new Error("อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ");
        }
        const user_number = await generateId("MMIN", user_type);
        const hashed_password = await bcrypt.hash(password, 10);
        const user = new UserModel({
          user_number,
          user_type,
          username: individual_detail.email,
          password: hashed_password,
          remark,
          registration: platform,
          is_verified_email: false,
          is_verified_phone_number: false,
          accept_policy_version,
          accept_policy_time,
        });
        const individual_customer = new CustomerIndividualModel({
          user_number,
          ...individual_detail,
        });

        await user.save();
        await individual_customer.save();
        // Email sender
        await email_transpoter.sendMail({
          from: process.env.GOOGLE_MAIL,
          to: individual_detail.email,
          subject: 'ยืนยันการสมัครสมาชิก Movemate!',
          template: 'register_individual',
          context: {
            fullname: individual_customer.fullName(),
            username: individual_detail.email,
            logo: image_url,
            activate_link: `https://api.movemateth.com/activate/customer/${user_number}`,
            movemate_link: `https://www.movemateth.com`,
          }
        })

        return user;
      }

      /**
       * Business Customer Register
       */
      if (user_type === "business" && business_detail) {
        if (!business_detail) {
          throw new Error("ข้อมูลไม่สมบูรณ์");
        }

        const is_existing_email_with_individual = await CustomerIndividualModel.findOne({
          email: business_detail.business_email,
        });
        if (is_existing_email_with_individual) {
          throw new Error("ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ");
        }

        const is_existing_email_with_business = await BusinessCustomerModel.findOne({
          business_email: business_detail.business_email,
        });
        if (is_existing_email_with_business) {
          throw new Error("อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ");
        }

        const user_number = await generateId("MMBU", user_type);
        const generated_password = generateRandomNumberPattern('MM##########').toLowerCase()
        const hashed_password = await bcrypt.hash(generated_password, 10);
        const user = new UserModel({
          user_number,
          user_type,
          username: user_number,
          password: hashed_password,
          remark,
          registration: platform,
          is_verified_email: false,
          is_verified_phone_number: false,
          accept_policy_version,
          accept_policy_time,
        });

        const business = new BusinessCustomerModel({
          ...business_detail,
          user_number,
        })

        if (business_detail.payment_method === 'cash' && business_detail.payment_cash_detail) {
          const cash_detail = business_detail.payment_cash_detail
          const cash_payment = new BusinessCustomerCashPaymentModel({
            user_number,
            accepted_ereceipt_date: cash_detail.accepted_ereceipt_date
          })
          await cash_payment.save()
        } else if (business_detail.payment_method === 'credit' && business_detail.payment_credit_detail) {
          const default_credit_limit = 20000.00
          const credit_detail = business_detail.payment_credit_detail
          const credit_payment = new BusinessCustomerCreditPaymentModel({
            ...credit_detail,
            billed_date: 7, // TODO: get default
            billed_round: 15, // TODO: get default
            user_number,
            credit_limit: default_credit_limit,
            credit_usage: 0,
          })
          await credit_payment.save()
        } else {
          throw new Error("ไม่พบข้อมูลการชำระ กรุณาติดต่อผู้ดูแลระบบ");
        }

        await business.save()
        await user.save();

        if (business_detail.payment_method === 'cash') {
          // Email sender
          await email_transpoter.sendMail({
            from: process.env.GOOGLE_MAIL,
            to: business_detail.business_email,
            subject: 'ยืนยันการสมัครสมาชิก Movemate!',
            template: 'register_business',
            context: {
              business_title: business_detail.business_titles,
              business_name: business_detail.business_name,
              username: user_number,
              password: generated_password,
              logo: image_url,
              activate_link: `https://api.movemateth.com/activate/customer/${user_number}`,
              movemate_link: `https://www.movemateth.com`,
            }
          })
        }
        return user;
      }

      return null;
    } catch (error) {
      throw new Error(error);
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
