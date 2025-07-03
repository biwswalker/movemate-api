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
import NotificationModel, { Notification } from '@models/notification.model'
import { LoadmoreArgs } from '@inputs/query.input'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { AdminNotificationCountPayload, UnreadCountPayload } from '@payloads/notification.payloads'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { sum } from 'lodash'
import { Repeater } from '@graphql-yoga/subscription'
import { EPaymentMethod } from '@enums/payments'
import { EShipmentStatus } from '@enums/shipments'
import { ERegistration, EUpdateUserStatus, EUserRole, EUserStatus, EUserType } from '@enums/users'
import TransactionModel from '@models/transaction.model'
import { TRANSACTION_DRIVER_LIST } from '@pipelines/transaction.pipeline'
import { EBillingStatus } from '@enums/billing'
import BillingModel from '@models/finance/billing.model'
import UserPendingModel from '@models/userPending.model'
import { GET_PENDING_USERS } from '@pipelines/userPending.pipeline'

export async function getAdminMenuNotificationCount(): Promise<AdminNotificationCountPayload> {
  const individualCustomer = await UserModel.countDocuments({
    status: EUserStatus.PENDING,
    userType: EUserType.INDIVIDUAL,
    userRole: EUserRole.CUSTOMER,
  }).catch(() => 0)
  const businessCustomer = await UserModel.countDocuments({
    status: EUserStatus.PENDING,
    userType: EUserType.BUSINESS,
    userRole: EUserRole.CUSTOMER,
  }).catch(() => 0)
  const individualDriver = await UserModel.countDocuments({
    status: EUserStatus.PENDING,
    userType: EUserType.INDIVIDUAL,
    userRole: EUserRole.DRIVER,
  }).catch(() => 0)
  const businessDriver = await UserModel.countDocuments({
    status: EUserStatus.PENDING,
    userType: EUserType.BUSINESS,
    userRole: EUserRole.DRIVER,
  }).catch(() => 0)
  const _driverPendingAggregate = await GET_PENDING_USERS({
    userRole: EUserRole.DRIVER,
    status: EUpdateUserStatus.PENDING,
  })
  const driverPending = await UserPendingModel.aggregate(_driverPendingAggregate)
    .then((response) => response.length || 0)
    .catch(() => 0)
  const _customerPendingAggregate = await GET_PENDING_USERS({
    userRole: EUserRole.CUSTOMER,
    status: EUpdateUserStatus.PENDING,
  })
  const customerPending = await UserPendingModel.aggregate(_customerPendingAggregate)
    .then((response) => response.length || 0)
    .catch(() => 0)
  const shipment = await ShipmentModel.countDocuments({
    $or: [{ status: EShipmentStatus.IDLE }, { status: EShipmentStatus.REFUND }],
  }).catch(() => 0)
  const financialCash = await BillingModel.countDocuments({
    status: { $in: [EBillingStatus.VERIFY, EBillingStatus.PENDING] },
    paymentMethod: EPaymentMethod.CASH,
  }).catch(() => 0)
  const financialCredit = await BillingModel.countDocuments({
    status: { $in: [EBillingStatus.VERIFY, EBillingStatus.PENDING] },
    paymentMethod: EPaymentMethod.CREDIT,
  }).catch(() => 0)
  const financialPayment = await TransactionModel.aggregate(TRANSACTION_DRIVER_LIST({ isPending: true }))

  const payload: AdminNotificationCountPayload = {
    customer: sum([individualCustomer, businessCustomer, customerPending]),
    individualCustomer,
    businessCustomer,
    customerPending,
    driver: sum([individualDriver, businessDriver, driverPending]),
    individualDriver,
    businessDriver,
    driverPending,
    shipment,
    financial: sum([financialCash, financialCredit]),
    financialCash,
    financialCredit,
    financialPayment: financialPayment.length,
  }
  return payload
}
@Resolver()
export default class NotificationResolver {
  private async publishGetNotificationUnreadCount(userId: string) {
    const notificationCount = await NotificationModel.countDocuments({ userId, read: false })
    await pubsub.publish(NOTFICATIONS.COUNT, userId, notificationCount)
    return notificationCount
  }

  @Query(() => [Notification])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async notifications(@Ctx() ctx: GraphQLContext, @Args() loadmore: LoadmoreArgs) {
    const userId = ctx.req.user_id
    const platform = ctx.req.headers['platform']
    if (userId) {
      const notifications = await NotificationModel.findByUserId(userId, loadmore)
      if (platform === ERegistration.APP) {
        await NotificationModel.updateMany({ _id: { $in: notifications.map((item) => item._id) } }, { read: true })
      }
      return notifications
    }
    return []
  }

  @Query(() => Notification)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async notification(@Ctx() ctx: GraphQLContext, @Arg('id') notificationId: string) {
    const userId = ctx.req.user_id
    if (userId) {
      const notification = await NotificationModel.findOne({ userId, _id: notificationId })
      await NotificationModel.markNotificationAsRead(notificationId)
      return notification
    }
    return undefined
  }

  @Query(() => UnreadCountPayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async unreadCount(@Ctx() ctx: GraphQLContext): Promise<UnreadCountPayload> {
    const userId = ctx.req.user_id
    const userRole = ctx.req.user_role
    if (userId) {
      const notificationCount = await this.publishGetNotificationUnreadCount(userId)
      if (userRole === EUserRole.CUSTOMER) {
        const shipment = await ShipmentModel.countDocuments({
          customer: userId,
          status: { $in: [EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING, EShipmentStatus.REFUND] },
        })
        await pubsub.publish(NOTFICATIONS.PROGRESSING_SHIPMENT, userId, shipment)
        return { notification: notificationCount, shipment }
      }
      return { notification: notificationCount, shipment: 0 }
    }
    return { notification: 0, shipment: 0 }
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async totalNotification(@Ctx() ctx: GraphQLContext): Promise<number> {
    const userId = ctx.req.user_id
    if (userId) {
      const notifications = await NotificationModel.countDocuments({ userId })
      return notifications
    }
    return 0
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async markNotificationAsRead(@Arg('notificationId') notificationId: string): Promise<boolean> {
    await NotificationModel.markNotificationAsRead(notificationId)
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
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

  @Subscription({
    topics: NOTFICATIONS.MESSAGE,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  listenNotificationMessage(@Root() payload: Notification, @Ctx() _: AuthContext): Notification {
    return payload
  }

  @Subscription({
    topics: NOTFICATIONS.MESSAGE_GROUP,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_role,
  })
  listenNotificationGroupMessage(@Root() payload: Notification, @Ctx() _: AuthContext): Notification {
    return payload
  }

  @Subscription(() => [Notification], {
    subscribe: async ({ context, args }) => {
      const { user_id } = context as AuthContext
      if (!user_id) {
        throw new Error('Authentication required')
      }

      // สร้าง Repeater ซึ่งเป็นตัวจัดการ stream ของข้อมูล
      return new Repeater(async (push, stop) => {
        // 1. ส่งข้อมูลเริ่มต้น (Initial Data) ทันทีที่เชื่อมต่อ
        const initialNotifications = await NotificationModel.findByUserId(user_id, args as LoadmoreArgs)
        await push(initialNotifications)

        // 2. Subscribe เฉพาะ topic ของ user คนนี้
        const subscription = pubsub.subscribe(NOTFICATIONS.MESSAGE, user_id)

        // 3. วนลูปเพื่อรอรับข้อมูลใหม่ๆ ที่ถูก publish เข้ามา
        for await (const newNotification of subscription) {
          // newNotification จะเป็น object Notification ตัวเดียว
          await push([newNotification])
        }

        await stop
      })
    },
  } as any)
  realtimeNotifications(
    @Root() payload: Notification[],
    @Args() args: LoadmoreArgs,
    @Ctx() ctx: AuthContext,
  ): Notification[] {
    // ส่งข้อมูลที่ได้รับไปยัง client
    return payload
  }
}
