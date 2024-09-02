import { Resolver, Mutation, Ctx, Arg, Args, Query, Int, UseMiddleware, Subscription, Root } from 'type-graphql'
import NotificationModel, { Notification } from '@models/notification.model'
import { LoadmoreArgs } from '@inputs/query.input'
import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { AdminNotificationCountPayload } from '@payloads/notification.payloads'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import BillingCycleModel, { EBillingStatus } from '@models/billingCycle.model'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { sum } from 'lodash'


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

    async getAdminMenuNotificationCount(): Promise<AdminNotificationCountPayload> {
        const individualCustomer = await UserModel.countDocuments({ status: 'pending', userType: 'individual', userRole: 'customer' }).catch(() => 0);
        const businessCustomer = await UserModel.countDocuments({ status: 'pending', userType: 'business', userRole: 'customer' }).catch(() => 0);
        const individualDriver = await UserModel.countDocuments({ status: 'pending', userType: 'individual', userRole: 'driver' }).catch(() => 0);
        const businessDriver = await UserModel.countDocuments({ status: 'pending', userType: 'business', userRole: 'driver' }).catch(() => 0);
        const shipment = await ShipmentModel.countDocuments({ $or: [{ status: 'idle' }, { status: 'refund' }] }).catch(() => 0);
        const financial = await BillingCycleModel.countDocuments({ billingStatus: { $in: [EBillingStatus.VERIFY, EBillingStatus.OVERDUE, EBillingStatus.REFUND] } }).catch(() => 0);

        const payload: AdminNotificationCountPayload = {
            customer: sum([individualCustomer, businessCustomer]),
            individualCustomer,
            businessCustomer,
            driver: sum([individualDriver, businessDriver]),
            individualDriver,
            businessDriver,
            shipment,
            financial,
        };
        await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, payload);

        return payload
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(["admin"]))
    async triggerAdminMenuNotificationCount(): Promise<boolean> {
        await this.getAdminMenuNotificationCount()
        return true
    }

    /**
     * 
     * @returns https://typegraphql.com/docs/subscriptions.html
     */
    @Subscription({ topics: NOTFICATIONS.GET_MENU_BADGE_COUNT })
    getAdminNotificationCount(@Root() payload: AdminNotificationCountPayload): AdminNotificationCountPayload {
        return payload
    }
}
