import { Resolver, Ctx, UseMiddleware, Query, Mutation, Arg } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { isEmpty } from 'lodash'
import { BookingConfigPayload } from '@payloads/booking.payloads'
import { AllowGuard, AuthGuard } from '@guards/auth.guards'
import VehicleCostModel from '@models/vehicleCost.model'
import { CalculationInput, PODAddressInput } from '@inputs/booking.input'
import PODAddressModel, { PODAddress } from '@models/podAddress.model'
import UserModel from '@models/user.model'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { Types } from 'mongoose'
import SearchHistoryModel from '@models/searchHistory.model'
import { ELimiterType, getLatestCount } from '@configs/rateLimit'
import { EPaymentMethod } from '@enums/payments'
import { EUserRole, EUserType } from '@enums/users'
import { calculateQuotation } from '@controllers/quotation'
import { CalculateQuotationResultPayload } from '@payloads/quotation.payloads'

@Resolver()
export default class BookingResolver {
  @Query(() => BookingConfigPayload)
  @UseMiddleware(AllowGuard)
  async getBookingConfig(@Ctx() ctx: GraphQLContext): Promise<BookingConfigPayload> {
    try {
      const isAuthorized = !isEmpty(ctx.req.user_id)
      let isBusinessCreditUser = false
      let faveriteDrivers = []
      if (isAuthorized) {
        const user = await UserModel.findById(ctx.req.user_id)
        if (user) {
          const drivers = await user.getFavoriteDrivers()
          if (drivers) {
            faveriteDrivers = drivers
          }
        }
        if (user && user.userType === EUserType.BUSINESS) {
          const businessCustomer = user.businessDetail as BusinessCustomer | undefined
          const isCredit = businessCustomer.paymentMethod === EPaymentMethod.CREDIT
          isBusinessCreditUser = isCredit
        }
      }

      // Get available
      // What is available: distance config are necessary to using for pricing calculation
      const vehicleCosts = await VehicleCostModel.findByAvailableConfig()

      // Get avaialble Payment Method
      const paymentMethods = [
        {
          available: true,
          method: EPaymentMethod.CASH,
          name: 'ชำระด้วยเงินสด',
          subTitle: 'ชำระผ่าน QR Promptpay ขั้นตอนถัดไป',
          detail: '',
        },
        {
          available: isAuthorized && isBusinessCreditUser,
          method: EPaymentMethod.CREDIT,
          name: 'ออกใบแจ้งหนี้',
          subTitle: 'สำหรับสมาชิก Movemate แบบองค์กร/บริษัท',
          detail: '',
        },
      ]

      return {
        vehicleCosts,
        paymentMethods,
        faveriteDrivers,
      }
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async addPODAddress(@Ctx() ctx: GraphQLContext, @Arg('data') { _id, ...data }: PODAddressInput): Promise<string> {
    try {
      const address = new PODAddressModel({ ...data, user: ctx.req.user_id })
      await address.save()
      return address._id
    } catch (error) {
      throw error
    }
  }

  @Query(() => [PODAddress])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async getPODAddress(@Ctx() ctx: GraphQLContext): Promise<PODAddress[]> {
    const user_id = ctx.req.user_id
    try {
      const address = await PODAddressModel.find({ user: user_id })
      return address
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async removePODAddress(@Ctx() ctx: GraphQLContext, @Arg('id') id: string): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      await PODAddressModel.findOneAndDelete({ user: user_id, _id: new Types.ObjectId(id) })
      return true
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => CalculateQuotationResultPayload)
  @UseMiddleware(AllowGuard)
  async subtotalCalculation(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: CalculationInput,
  ): Promise<CalculateQuotationResultPayload> {
    const customerId = ctx.req.user_id
    try {
      const result = await calculateQuotation(data, customerId)

      const ip = ctx.ip
      const type: TSearchType = 'pricing'
      const count = await getLatestCount(ip, ELimiterType.LOCATION, ctx.req.user_id || '')
      const searchHistory = new SearchHistoryModel({
        ipaddress: ip,
        isCache: false,
        user: customerId,
        inputRaw: JSON.stringify(data),
        resultRaw: JSON.stringify(result),
        limit: ctx.req.limit,
        type: type,
        count,
      })

      await searchHistory.save()

      return result
    } catch (error) {
      console.log('error: ', error)
      throw error
    }
  }
}
