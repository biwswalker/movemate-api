import {
  Resolver,
  Query,
  Arg,
  Ctx,
  UseMiddleware,
  AuthenticationError,
  Args,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import { GetCustomersArgs } from "@inputs/user.input";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { isArray, reduce } from "lodash";
import { UserPaginationPayload } from "@payloads/user.payloads";
import { FilterQuery, PaginateOptions } from "mongoose";
import { PaginationArgs } from "@inputs/query.input";

@Resolver(User)
export default class UserResolver {

  @Query(() => UserPaginationPayload)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async users(
    @Args() query: GetCustomersArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs
  ): Promise<UserPaginationPayload> {
    try {
      const options: FilterQuery<typeof User> = {
        ...query,
      }

      const pagination: PaginateOptions = {
        ...paginationArgs,
        ...(isArray(sortField) ? {
          sort: reduce(sortField, function (result, value) {
            return { ...result, [value]: sortAscending ? 1 : -1 };
          }, {})
        } : {})
      }

      const users = await UserModel.paginate(options, pagination) as UserPaginationPayload

      return users
    } catch (error) {
      console.log(error)
      throw new Error("Failed to fetch users");
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
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
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
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
      throw error
    }
  }

}
