import UserModel from '@models/user.model'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLError } from 'graphql'
import { Arg, Args, Query, Resolver, UseMiddleware } from 'type-graphql'
import { GetUserArgs } from '@inputs/user.input'
import { PaginationArgs } from '@inputs/query.input'
import { GET_USER_LIST } from '@pipelines/customer.pipeline'
import { reformPaginate } from '@utils/pagination.utils'
import { GetUserListPaginationPayload } from '@payloads/customer.payloads'
import { map } from 'lodash'

@Resolver()
export default class CustomerResolver {
  @Query(() => GetUserListPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getUserList(
    @Arg('filters', { nullable: true }) filters: GetUserArgs,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<GetUserListPaginationPayload> {
    try {
      const { sort = undefined, ...pagination } = reformPaginate(paginationArgs)
      const pipeline = GET_USER_LIST(filters, sort)
      console.log('pipeline', JSON.stringify(pipeline, undefined, 2))
      const aggregate = UserModel.aggregate(pipeline)
      const _users = (await UserModel.aggregatePaginate(aggregate, pagination)) as GetUserListPaginationPayload
      return _users
    } catch (error) {
      console.error(`Error in getCustomer:`, error)
      if (error instanceof GraphQLError) {
        throw error
      }
      throw new Error('ไม่สามารถเรียกข้อมูลลูกค้าได้')
    }
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAllUserIds(@Arg('filters', { nullable: true }) filters: GetUserArgs): Promise<string[]> {
    try {
      const users = await UserModel.aggregate(GET_USER_LIST(filters))
      const ids = map(users, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }
}
