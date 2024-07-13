import { Resolver, Ctx, UseMiddleware, Query, Mutation, Arg, Args } from "type-graphql";
import { GraphQLContext } from "@configs/graphQL.config";
import { get, isEmpty, sum } from "lodash";
import { BookingConfigPayload, SubtotalCalculatedPayload } from "@payloads/booking.payloads";
import { AllowGuard, AuthGuard } from "@guards/auth.guards";
import VehicleCostModel from "@models/vehicleCost.model";
import { PODAddressInput, SubtotalCalculationArgs } from "@inputs/booking.input";
import PODAddressModel from "@models/podAddress.model";
import { fNumber } from "@utils/formatNumber";
import AdditionalServiceCostPricingModel from "@models/additionalServiceCostPricing.model";
import UserModel from "@models/user.model";

@Resolver()
export default class BookingResolver {
  @Query(() => BookingConfigPayload)
  @UseMiddleware(AllowGuard)
  async getBookingConfig(
    @Ctx() ctx: GraphQLContext
  ): Promise<BookingConfigPayload> {
    try {
      // To using login user or not
      // ctx.req.user_id
      // TODO
      const isAuthorized = !isEmpty(ctx.req.user_id);
      let isBusinessUser = false
      if (isAuthorized) {
        const user = await UserModel.findById(ctx.req.user_id).lean()
        isBusinessUser = user.userType === 'business'
      }

      // Get available
      // What is available: distance config are necessary to using for pricing calculation
      const vehicleCosts = await VehicleCostModel.findByAvailableConfig();

      // Get avaialble Payment Method
      const paymentMethods = [
        { available: true, method: "cash", name: "ชำระด้วยเงินสด", subTitle: 'ชำระผ่าน QR Promptpay ขั้นตอนถัดไป', detail: '' },
        { available: isAuthorized && isBusinessUser, method: "credit", name: "ออกใบแจ้งหนี้", subTitle: 'สำหรับสมาชิก Movemate แบบองค์กร/บริษัท', detail: '' },
      ];

      return {
        vehicleCosts,
        paymentMethods,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard(['customer']))
  async addPODAddress(@Ctx() ctx: GraphQLContext, @Arg("data") data: PODAddressInput): Promise<string> {
    try {
      const address = new PODAddressModel({ data, user: ctx.req.user_id })
      await address.save()
      return address._id
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => SubtotalCalculatedPayload)
  async subtotalCalculation(
    @Ctx() ctx: GraphQLContext,
    @Args() { vehicleTypeId, distanceMeter, dropPoint, isRounded, discountId, serviceIds }: SubtotalCalculationArgs
  ): Promise<SubtotalCalculatedPayload> {
    try {
      const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId)
      const distanceKilometers = (distanceMeter / 1000) // TODO: Recheck decimal calculation with owner
      const calculated = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: distanceKilometers, // TODO: Recheck decimal calculation with owner
        dropPoint,
        isRounded
      })

      const vehicleName = get(vehicleCost, 'vehicleType.name', '')
      const distanceKM = fNumber(distanceKilometers, '0.0')

      const additionalservices = await AdditionalServiceCostPricingModel.getServicesPricing(serviceIds)

      // TODO: Discount

      const total = sum([calculated.totalPrice, additionalservices.price])
      return {
        shippingPrices: [
          { label: `${vehicleName} (${distanceKM} กม.)`, price: calculated.subTotalPrice },
          ...(isRounded ? [{ label: 'ไป-กลับ', price: calculated.subTotalRoundedPrice }] : []),
        ],
        additionalServices: [
          ...(dropPoint > 1 ? [{ label: 'หลายจุดส่ง', price: calculated.subTotalDropPointPrice }] : []),
          ...additionalservices.priceItems
        ],
        discounts: [],
        total: total,
      }
    } catch (error) {
      throw error;
    }
  }
}
