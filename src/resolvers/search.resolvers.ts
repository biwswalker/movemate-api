import { GraphQLContext } from '@configs/graphQL.config'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { PaginationArgs } from '@inputs/query.input'
import BusinessCustomerModel from '@models/customerBusiness.model'
import IndividualCustomerModel from '@models/customerIndividual.model'
import SearchHistoryModel, { SearchHistory } from '@models/searchHistory.model'
import UserModel from '@models/user.model'
import { SearchHistoryPaginationPayload } from '@payloads/search.payloads'
import { reformPaginate } from '@utils/pagination.utils'
import { GraphQLError } from 'graphql'
import { map } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Query, Resolver, UseMiddleware } from 'type-graphql'

@Resolver(SearchHistory)
export default class SearchHistoryResolver {
  @Query(() => SearchHistoryPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async searchHistorys(
    @Ctx() ctx: GraphQLContext,
    @Arg('search', { nullable: true }) search: string,
    @Arg('startDate', { nullable: true }) startDate: Date,
    @Arg('endDate', { nullable: true }) endDate: Date,
    @Args() paginate: PaginationArgs,
  ): Promise<SearchHistoryPaginationPayload> {
    // Pagination
    const pagination: PaginateOptions = reformPaginate(paginate)

    const matchingIndividuals = search
      ? await IndividualCustomerModel.find(
          { $or: [{ firstname: { $regex: search, $options: 'i' } }, { lastname: { $regex: search, $options: 'i' } }] },
          '_id',
        )
      : []
    const matchingBusinesses = search
      ? await BusinessCustomerModel.find({ businessName: { $regex: search, $options: 'i' } }, '_id')
      : []

    const startOfSearch = startDate ? new Date(new Date(startDate).setHours(0, 0, 0, 0)) : null
    const endOfSearch = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null

    const filterQuery: FilterQuery<typeof SearchHistory> = {
      type: 'pricing',
      ...(search
        ? {
            $or: [
              { ipaddress: { $regex: search, $options: 'i' } }, // Search in ipaddress
              {
                user: {
                  $in: await UserModel.find(
                    {
                      $or: [
                        { individualDetail: { $in: matchingIndividuals } }, // Check if user has a matching individualDetail
                        { businessDetail: { $in: matchingBusinesses } }, // Check if user has a matching businessDetail
                      ],
                    },
                    '_id',
                  ),
                },
              },
            ],
          }
        : {}),
      ...(startOfSearch && endOfSearch
        ? {
            createdAt: {
              ...(startOfSearch ? { $gte: startOfSearch } : {}),
              ...(endOfSearch ? { $lte: endOfSearch } : {}),
            },
          }
        : {}),
    }

    const searchHistory = (await SearchHistoryModel.paginate(filterQuery, pagination)) as SearchHistoryPaginationPayload
    if (!searchHistory) {
      const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้`
      throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
    }

    return {
      ...searchHistory,
      docs: map(searchHistory.docs, (doc) => {
        return Object.assign(doc, {
          count: doc.count === Infinity ? -1 : doc.count,
          limit: doc.limit === Infinity ? -1 : doc.limit,
        })
      }),
    }
  }
}
