import { prop as Property, Severity, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { Field, ObjectType, ID, registerEnumType } from 'type-graphql'
import UserModel from './user.model'
import { LoadmoreArgs } from '@inputs/query.input'
import admin from '@configs/firebase'
import { Message } from 'firebase-admin/messaging'
import lodash, { isArray } from 'lodash'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { ClientSession } from 'mongoose'
import { EUserRole } from '@enums/users'
import Aigle from 'aigle'
import { decryption } from '@utils/encryption'

Aigle.mixin(lodash, {})

export enum ENavigationType {
  INDEX = 'index',
  EMPLOYEE = 'employee',
  SHIPMENT = 'shipment',
  SHIPMENT_WORK = 'shipment-work',
  FINANCE = 'finance',
  NOTIFICATION = 'notification',
  PROFILE = 'profile',
  PROFILE_DETAIL = 'profile-detail',
  PROFILE_DOCUMENT = 'profile-document',
}
registerEnumType(ENavigationType, {
  name: 'ENavigationType',
  description: 'Navigation type',
})

export enum ENotificationVarient {
  INFO = 'info',
  ERROR = 'error',
  WRANING = 'warning',
  SUCCESS = 'success',
  MASTER = 'master',
}
registerEnumType(ENotificationVarient, {
  name: 'ENotificationVarient',
  description: 'Notification varient',
})

export const NOTIFICATION_TITLE = 'MovemateTH'

interface INotification {
  userId: string
  varient: ENotificationVarient
  title: string
  message: string[]
  infoText?: string
  infoLink?: string
  errorText?: string
  errorLink?: string
  masterText?: string
  masterLink?: string
  permanent?: boolean
  read?: boolean
}

@ObjectType()
export class Notification extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  userId: string

  @Field()
  @Property({ enum: ENotificationVarient, default: ENotificationVarient.INFO })
  varient: ENotificationVarient

  @Field()
  @Property({ required: true })
  title: string

  @Field(() => [String])
  @Property({ required: true, allowMixed: Severity.ALLOW })
  message: string[]

  @Field({ nullable: true })
  @Property()
  infoText: string

  @Field({ nullable: true })
  @Property()
  infoLink: string

  @Field({ nullable: true })
  @Property()
  errorText: string

  @Field({ nullable: true })
  @Property()
  errorLink: string

  @Field({ nullable: true })
  @Property()
  masterText: string

  @Field({ nullable: true })
  @Property()
  masterLink: string

  @Field({ defaultValue: false })
  @Property({ default: false })
  permanent?: boolean

  @Field()
  @Property({ default: false })
  read: boolean

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static async sendNotification(
    data: INotification,
    session?: ClientSession,
    pushNotificationIncluded = false,
    extra?: Record<string, any>
  ): Promise<void> {
    const notification = new NotificationModel({ ...data, read: false })
    await notification.save({ session })
    await UserModel.findByIdAndUpdate(data.userId, { $push: { notifications: notification._id } }, { session })
    // Message Notification
    const _notificationObject = notification.toObject()
    await pubsub.publish(NOTFICATIONS.MESSAGE, data.userId, _notificationObject) // ส่ง Real-time update
    // Count Notification
    const unreadCount = await NotificationModel.countDocuments({ userId: data.userId, read: false }, { session })
    await pubsub.publish(NOTFICATIONS.COUNT, data.userId, unreadCount)
    // Publish push Notification
    if (pushNotificationIncluded) {
      const { fcmToken } = await UserModel.findOne({ _id: data.userId }, { fcmToken: 1 }) // ค้นหา FCM Token ของ User
      if (fcmToken) {
        const token = decryption(fcmToken)
        await this.sendFCMNotification({
          token,
          ...(extra ? { data: extra } : {}),
          notification: { title: data.title, body: data.message.join(' ') },
        })
      }
    }
    console.log('[Notification] End SendNotification', data.title)
  }

  static async sendNotificationToAdmins(data: Omit<INotification, 'userId'>, session?: ClientSession): Promise<void> {
    const adminUserIds = await UserModel.find({ userRole: EUserRole.ADMIN }).distinct('_id') // ค้นหาแอดมินทั้งหมด
    await Aigle.each(adminUserIds, async (adminUser) => {
      const _notification = new NotificationModel({ ...data, read: false, userId: adminUser })
      await _notification.save({ session }) // สร้าง Notification
      await UserModel.findByIdAndUpdate(adminUser, { $push: { notifications: _notification._id } }, { session }) // เพิ่ม Notification ไปยัง User
      const unreadCount = await NotificationModel.countDocuments({ userId: adminUser, read: false }, { session })
      await pubsub.publish(NOTFICATIONS.COUNT, adminUser, unreadCount) // ส่ง Real-time update
    })
    const _groupNotification = new NotificationModel({ ...data, userId: 'group' }).toObject()
    await pubsub.publish(NOTFICATIONS.MESSAGE_GROUP, EUserRole.ADMIN, _groupNotification) // ส่ง Real-time update
    console.log('[Notification] SendNotificationToAdmins', data.title)
  }

  static async sendFCMNotification(data: Message | Message[]): Promise<void> {
    if (isArray(data)) {
      await admin.messaging().sendEach(data)
    } else if (typeof data === 'object') {
      await admin
        .messaging()
        .send(data)
        .then((res) => {
          console.log('response: ', res)
          return res
        })
        .catch((error) => {
          console.log(JSON.stringify(error))
          throw error
        })
    }
  }
  static async markNotificationAsRead(_id: string): Promise<void> {
    const notification = await NotificationModel.findByIdAndUpdate(_id, { read: true })
    const unreadCount = await NotificationModel.countDocuments({ userId: notification.userId, read: false })
    await pubsub.publish(NOTFICATIONS.COUNT, notification.userId, unreadCount)
  }

  static async findByUserId(userId: string, { skip, limit }: LoadmoreArgs): Promise<Notification[]> {
    const notifications = await NotificationModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec()
    return notifications
  }
}

const NotificationModel = getModelForClass(Notification)

export default NotificationModel
