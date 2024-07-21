import { Resolver, Mutation, Ctx, Arg, Args, Query, Int, UseMiddleware } from 'type-graphql'
import NotificationModel, { Notification } from '@models/notification.model'
import { LoadmoreArgs } from '@inputs/query.input'
import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'

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
            const notifications = await NotificationModel.find({ userId, read: false })
            return notifications.length
        }
        return 0
    }

    @Query(() => Int)
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async totalNotification(@Ctx() ctx: GraphQLContext): Promise<number> {
        const userId = ctx.req.user_id
        if (userId) {
            const notifications = await NotificationModel.find({ userId })
            return notifications.length
        }
        return 0
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
    async markNotificationAsRead(@Arg("notificationId") notificationId: string): Promise<boolean> {
        await NotificationModel.markNotificationAsRead(notificationId)
        return true;
    }
}
