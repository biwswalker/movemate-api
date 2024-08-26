import { Resolver, Mutation, Ctx, Arg, Args, Query, Int, UseMiddleware } from 'type-graphql'
import NotificationModel, { Notification } from '@models/notification.model'
import { LoadmoreArgs } from '@inputs/query.input'
import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { AdminNotificationCountPayload } from '@payloads/notification.payloads'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import { sum } from 'lodash'
import BillingCycleModel, { EBillingStatus } from '@models/billingCycle.model'

@Resolver()
export default class NotificationResolver {

    @Query(() => [Notification])
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async notifications(@Ctx() ctx: GraphQLContext, @Args() loadmore: LoadmoreArgs) {
        const userId = ctx.req.user_id
        if (userId) {
            const notifications = await NotificationModel.findByUserId(userId, loadmore)
            return notifications;
        }
        return []
    }

    @Query(() => Int)
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async unreadCount(@Ctx() ctx: GraphQLContext): Promise<number> {
        const userId = ctx.req.user_id
        if (userId) {
            const notifications = await NotificationModel.countDocuments({ userId, read: false })
            return notifications
        }
        return 0
    }

    @Query(() => Int)
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async totalNotification(@Ctx() ctx: GraphQLContext): Promise<number> {
        const userId = ctx.req.user_id
        if (userId) {
            const notifications = await NotificationModel.countDocuments({ userId })
            return notifications
        }
        return 0
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async markNotificationAsRead(@Arg("notificationId") notificationId: string): Promise<boolean> {
        await NotificationModel.markNotificationAsRead(notificationId)
        return true;
    }


    @Query(() => AdminNotificationCountPayload)
    @UseMiddleware(AuthGuard(["admin"]))
    async getAdminNotificationCount(@Ctx() ctx: GraphQLContext): Promise<AdminNotificationCountPayload> {
        const individualCustomer = await UserModel.countDocuments({ status: 'pending', userType: 'individual', userRole: 'customer' }).catch(() => 0)
        // TODO : Business including upgrade request
        const businessCustomer = await UserModel.countDocuments({ status: 'pending', userType: 'business', userRole: 'customer' }).catch(() => 0)
        const individualDriver = await UserModel.countDocuments({ status: 'pending', userType: 'individual', userRole: 'driver' }).catch(() => 0)
        const businessDriver = await UserModel.countDocuments({ status: 'pending', userType: 'business', userRole: 'driver' }).catch(() => 0)
        const shipment = await ShipmentModel.countDocuments({ $or: [{ status: 'idle' }, { status: 'refund' }] }).catch(() => 0)
        const financial = await BillingCycleModel.countDocuments({ $or: [{ status: EBillingStatus.CURRENT }, { status: EBillingStatus.OVERDUE }, { status: EBillingStatus.REFUND }] }).catch(() => 0)
        return {
            customer: sum([individualCustomer, businessCustomer]),
            individualCustomer,
            businessCustomer,
            driver: sum([individualDriver, businessDriver]),
            individualDriver,
            businessDriver,
            shipment,
            financial,
        }
    }

}
