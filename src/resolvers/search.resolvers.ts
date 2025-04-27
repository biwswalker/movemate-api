import { GraphQLContext } from '@configs/graphQL.config'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { PaginationArgs } from '@inputs/query.input'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import BusinessCustomerModel from '@models/customerBusiness.model'
import IndividualCustomerModel from '@models/customerIndividual.model'
import PrivilegeModel from '@models/privilege.model'
import SearchHistoryModel, { SearchHistory } from '@models/searchHistory.model'
import UserModel from '@models/user.model'
import VehicleTypeModel from '@models/vehicleType.model'
import { SearchHistoryPaginationPayload } from '@payloads/search.payloads'
import { reformPaginate } from '@utils/pagination.utils'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import lodash, { get, map, pick } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Query, Resolver, UseMiddleware } from 'type-graphql'

Aigle.mixin(lodash, {})

@Resolver(SearchHistory)
export default class SearchHistoryResolver {
  @Query(() => SearchHistoryPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async searchHistorys(
    @Ctx() _: GraphQLContext,
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

    const _completeData = await Aigle.map(searchHistory.docs || [], async (doc) => {
      const _inputString = typeof doc.inputRaw === 'string' && doc.inputRaw ? doc.inputRaw : '{}'
      const _input = JSON.parse(_inputString)
      const _resultString = typeof doc.resultRaw === 'string' && doc.resultRaw ? doc.resultRaw : '{}'
      const _result = JSON.parse(_resultString)

      /**
       * Pricing
       */
      if (doc.type === 'pricing') {
        // Input
        const _shipmentId = get(_input, 'shipmentId', '')
        const _locations = get(_input, 'locations', [])
        const _isRounded = get(_input, 'isRounded', false) as boolean
        const _vehicleTypeId = get(_input, 'vehicleTypeId', '')
        const _serviceIds = get(_input, 'serviceIds', '')
        const _discountId = get(_input, 'discountId', '')

        const _vehicleName = await VehicleTypeModel.findById(_vehicleTypeId).distinct<'name', string>('name')
        const _services = await AdditionalServiceCostPricingModel.find({ _id: { $in: _serviceIds } })
        const _serviceNames = map(_services, (_service) => get(_service, 'additionalService.name', ''))
        const _discount = _discountId ? await PrivilegeModel.findById(_discountId).distinct<'name', string>('name') : []

        const _response = {
          ...(pick(doc, [
            '_id',
            'ipaddress',
            'user',
            'type',
            'isCache',
            'count',
            'limit',
            'inputRaw',
            'resultRaw',
            'createdAt',
            'updatedAt',
          ]) as any),
          input: {
            shipmentId: _shipmentId,
            locations: _locations,
            isRounded: _isRounded,
            vehicleTypeId: _vehicleTypeId,
            serviceIds: _serviceIds,
            discountId: _discountId,
            // Additional Key
            vehicleName: _vehicleName.join(', '),
            services: _serviceNames.join(', '),
            discount: _discount.join(', '),
          },
          result: _result,
        }
        return _response
      }
      return doc
    })

    const _docs = map(_completeData, (doc) => {
      return Object.assign(doc, {
        count: doc.count === Infinity ? -1 : doc.count,
        limit: doc.limit === Infinity ? -1 : doc.limit,
      })
    })

    return {
      ...searchHistory,
      docs: _docs,
    }
  }
}
