import { Resolver, Ctx, UseMiddleware, Query } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { isEmpty } from 'lodash'
import { BookingConfigPayload } from '@payloads/booking.payloads'
import { AllowGuard } from '@guards/auth.guards'
import VehicleCostModel from '@models/vehicleCost.model'

@Resolver()
export default class BookingResolver {

    @Query(() => BookingConfigPayload)
    @UseMiddleware(AllowGuard)
    async getBookingConfig(@Ctx() ctx: GraphQLContext): Promise<BookingConfigPayload> {
        try {
            // To using login user or not
            // ctx.req.user_id
            const isAuthorized = !isEmpty(ctx.req.user_id)

            const vehicleCosts = await VehicleCostModel.find()
            const paymentMethods = [{ available: true, method: 'cash' }, { available: isAuthorized, method: 'credit' }]

            return {
                vehicleCosts,
                paymentMethods
            }
        } catch (error) {
            console.log(error)
            throw error
        }
    }
}
