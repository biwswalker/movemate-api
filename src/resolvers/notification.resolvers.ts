import {
  Resolver,
  Mutation,
  Ctx,
  Arg,
  Args,
  Query,
  Int,
  UseMiddleware,
  Subscription,
  Root,
  SubscribeResolverData,
} from 'type-graphql'
import NotificationModel, { ENavigationType, Notification } from '@models/notification.model'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { AdminNotificationCountPayload, UnreadCountPayload } from '@payloads/notification.payloads'
import ShipmentModel, { EShipingStatus } from '@models/shipment.model'
import UserModel, { EUserRole } from '@models/user.model'
import BillingCycleModel, { EBillingStatus } from '@models/billingCycle.model'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { sum } from 'lodash'
import { decryption } from '@utils/encryption'
import { Repeater } from '@graphql-yoga/subscription'
import { EPaymentMethod } from '@models/payment.model'

export async function getAdminMenuNotificationCount(): Promise<AdminNotificationCountPayload> {
  const individualCustomer = await UserModel.countDocuments({
    status: 'pending',
    userType: 'individual',
    userRole: 'customer',
  }).catch(() => 0)
  const businessCustomer = await UserModel.countDocuments({
    status: 'pending',
    userType: 'business',
    userRole: 'customer',
  }).catch(() => 0)
  const individualDriver = await UserModel.countDocuments({
    status: 'pending',
    userType: 'individual',
    userRole: 'driver',
  }).catch(() => 0)
  const businessDriver = await UserModel.countDocuments({
    status: 'pending',
    userType: 'business',
    userRole: 'driver',
  }).catch(() => 0)
  const shipment = await ShipmentModel.countDocuments({ $or: [{ status: 'idle' }, { status: 'refund' }] }).catch(
    () => 0,
  )
  const financialCash = await BillingCycleModel.countDocuments({
    billingStatus: { $in: [EBillingStatus.VERIFY, EBillingStatus.OVERDUE, EBillingStatus.REFUND] },
    paymentMethod: EPaymentMethod.CASH,
  }).catch(() => 0)
  const financialCredit = await BillingCycleModel.countDocuments({
    billingStatus: { $in: [EBillingStatus.VERIFY, EBillingStatus.OVERDUE, EBillingStatus.REFUND] },
    paymentMethod: EPaymentMethod.CREDIT,
  }).catch(() => 0)

  const payload: AdminNotificationCountPayload = {
    customer: sum([individualCustomer, businessCustomer]),
    individualCustomer,
    businessCustomer,
    driver: sum([individualDriver, businessDriver]),
    individualDriver,
    businessDriver,
    shipment,
    financial: sum([financialCash, financialCredit]),
    financialCash,
    financialCredit,
  }
  return payload
}
@Resolver()
export default class NotificationResolver {
  @Query(() => [Notification])
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async notifications(@Ctx() ctx: GraphQLContext, @Args() loadmore: LoadmoreArgs) {
    const userId = ctx.req.user_id
    if (userId) {
      const notifications = await NotificationModel.findByUserId(userId, loadmore)
      return notifications
    }
    return []
  }

  @Query(() => Notification)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async notification(@Ctx() ctx: GraphQLContext, @Arg('id') notificationId: string) {
    const userId = ctx.req.user_id
    if (userId) {
      const notification = await NotificationModel.findOne({ userId, _id: notificationId })
      return notification
    }
    return undefined
  }

  @Query(() => UnreadCountPayload)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async unreadCount(@Ctx() ctx: GraphQLContext): Promise<UnreadCountPayload> {
    const userId = ctx.req.user_id
    if (userId) {
      const notification = await NotificationModel.countDocuments({ userId, read: false })
      await pubsub.publish(NOTFICATIONS.COUNT, userId, notification)
      const shipment = await ShipmentModel.countDocuments({
        customer: userId,
        status: { $in: [EShipingStatus.IDLE, EShipingStatus.PROGRESSING, EShipingStatus.REFUND] },
      })
      await pubsub.publish(NOTFICATIONS.PROGRESSING_SHIPMENT, userId, shipment)
      return { notification, shipment }
    }
    return { notification: 0, shipment: 0 }
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async totalNotification(@Ctx() ctx: GraphQLContext): Promise<number> {
    const userId = ctx.req.user_id
    if (userId) {
      const notifications = await NotificationModel.countDocuments({ userId })
      return notifications
    }
    return 0
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async markNotificationAsRead(@Arg('notificationId') notificationId: string): Promise<boolean> {
    await NotificationModel.markNotificationAsRead(notificationId)
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async triggerAdminMenuNotificationCount(): Promise<boolean> {
    const payload = await getAdminMenuNotificationCount()
    await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, payload)
    return true
  }

  /**
   *
   * @returns https://typegraphql.com/docs/subscriptions.html
   */
  @Subscription({
    topics: NOTFICATIONS.GET_MENU_BADGE_COUNT,
    subscribe: async () => {
      console.log('ListenAdminNotificationCoun Subscribe: ')
      const repeater = new Repeater(async (push, stop) => {
        const notificationCount = await getAdminMenuNotificationCount()
        push(notificationCount)
        await stop
      })
      return Repeater.merge([repeater, pubsub.subscribe(NOTFICATIONS.GET_MENU_BADGE_COUNT)])
    },
  } as any)
  getAdminNotificationCount(@Root() payload: AdminNotificationCountPayload): AdminNotificationCountPayload {
    return payload
  }

  @Mutation(() => Boolean)
  async sentTextDriverNotification(): Promise<boolean> {
    const driver = await UserModel.findOne({ userRole: EUserRole.DRIVER })
    if (driver && driver.fcmToken) {
      const token = decryption(driver.fcmToken)
      console.log('decrypt token', token)
      await NotificationModel.sendFCMNotification({
        token,
        data: {
          navigation: ENavigationType.SHIPMENT,
          trackingNumber: 'xxxxxTESTxxxxxx',
        },
        notification: {
          title: 'MovemateTH',
          body: '📦 มีงานขนส่งใหม่เฉพาะคุณ',
        },
      })
    }
    return true
  }

  @Subscription({
    topics: NOTFICATIONS.COUNT,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  listenNotificationCount(@Root() payload: number, @Ctx() context: AuthContext): number {
    return payload
  }

  @Subscription({
    topics: NOTFICATIONS.PROGRESSING_SHIPMENT,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  listenProgressingShipmentCount(@Root() payload: number): number {
    return payload
  }
}
