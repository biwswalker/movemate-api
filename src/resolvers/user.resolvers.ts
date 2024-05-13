import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import CustomerIndividualModel, {
  IndividualCustomer,
} from "@models/customerIndividual.model";
import BusinessCustomerModel, {
  BusinessCustomer,
} from "@models/customerBusiness.model";
import { RegisterInput, UpdateUserInput } from "@inputs/user.input";
import bcrypt from "bcrypt";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { isEmpty } from "lodash";
import { generateId } from "@utils/string.utils";
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
        const individual_customer = new IndividualCustomerModel({
          user_number,
          ...individual_detail,
        });

        await user.save();
        await individual_customer.save();
        return user;
      }

      if (user_type === "business" && business_detail) {
        const is_existing_email_with_individual =
          await CustomerIndividualModel.findOne({
            email: business_detail.business_email,
          });
        const is_existing_email_with_business =
          await BusinessCustomerModel.findOne({
            business_email: business_detail.business_email,
          });
        if (
          is_existing_email_with_individual ||
          is_existing_email_with_business
        ) {
          throw new Error("อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ");
        }

        const user_number = await generateId("MMBU", user_type);
        const hashed_password = await bcrypt.hash(password, 10);
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

        await user.save();
        return user;
      }

      //
      const number_prefix = user_type === "business" ? "BU" : "CU";
      const user_number = await generateId(number_prefix, user_type);
      const status: TUserStatus = "active";
      const validation_status: TUserValidationStatus = "validating";

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new UserModel({
        user_number,
        user_type,
        // username: email,
        password: hashedPassword,
        status,
        validation_status,
        registration: platform,
        is_verified_email: false,
        is_verified_phone_number: false,
        accept_policy_version,
        accept_policy_time,
      });

      await user.save();

      // TODO: user detail

      return user;
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
