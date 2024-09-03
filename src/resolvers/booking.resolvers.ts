import { Resolver, Ctx, UseMiddleware, Query, Mutation, Arg, Args } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { isEmpty } from 'lodash'
import { BookingConfigPayload, SubtotalCalculatedPayload } from '@payloads/booking.payloads'
import { AllowGuard, AuthGuard } from '@guards/auth.guards'
import VehicleCostModel from '@models/vehicleCost.model'
import { PODAddressInput, SubtotalCalculationArgs } from '@inputs/booking.input'
import PODAddressModel, { PODAddress } from '@models/podAddress.model'
import UserModel from '@models/user.model'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { Types } from 'mongoose'
import ShipmentModel from '@models/shipment.model'
import SearchHistoryModel from '@models/searchHistory.model'
import { ELimiterType, getLatestCount } from '@configs/rateLimit'

@Resolver()
export default class BookingResolver {
  @Query(() => BookingConfigPayload)
  @UseMiddleware(AllowGuard)
  async getBookingConfig(@Ctx() ctx: GraphQLContext): Promise<BookingConfigPayload> {
    try {
      const isAuthorized = !isEmpty(ctx.req.user_id)
      let isBusinessCreditUser = false
      if (isAuthorized) {
        const user = await UserModel.findById(ctx.req.user_id)
        if (user.userType === 'business') {
          const businessCustomer = user.businessDetail as BusinessCustomer | undefined
          const isCredit = businessCustomer.paymentMethod === 'credit'
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
          method: 'cash',
          name: 'ชำระด้วยเงินสด',
          subTitle: 'ชำระผ่าน QR Promptpay ขั้นตอนถัดไป',
          detail: '',
        },
        {
          available: isAuthorized && isBusinessCreditUser,
          method: 'credit',
          name: 'ออกใบแจ้งหนี้',
          subTitle: 'สำหรับสมาชิก Movemate แบบองค์กร/บริษัท',
          detail: '',
        },
      ]

      return {
        vehicleCosts,
        paymentMethods,
      }
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard(['customer']))
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
  @UseMiddleware(AuthGuard(['customer']))
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
  @UseMiddleware(AuthGuard(['customer']))
  async removePODAddress(@Ctx() ctx: GraphQLContext, @Arg("id") id: string): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      await PODAddressModel.findOneAndDelete({ user: user_id, _id: new Types.ObjectId(id) })
      return true
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => SubtotalCalculatedPayload)
  @UseMiddleware(AllowGuard)
  async subtotalCalculation(
    @Ctx() ctx: GraphQLContext,
    @Args() args: SubtotalCalculationArgs,
  ): Promise<SubtotalCalculatedPayload> {
    try {
      const calculate = await ShipmentModel.calculate(args)

      const ip = ctx.ip
      const type: TSearchType = 'pricing'
      const count = await getLatestCount(ip, ELimiterType.LOCATION)
      const searchHistory = new SearchHistoryModel({
        ipaddress: ip,
        isCache: false,
        inputRaw: JSON.stringify(args),
        resultRaw: JSON.stringify(calculate),
        count,
        limit: ctx.req.limit,
        type: type,
      })

      await searchHistory.save()
      return calculate
    } catch (error) {
      throw error
    }
  }
}
