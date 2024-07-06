import { prop as Property, Severity, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { Field, ObjectType, ID } from 'type-graphql'
import UserModel from './user.model'
import { LoadmoreArgs } from '@inputs/query.input'

enum ENotificationVarient {
    INFO = 'info',
    ERROR = 'error',
    WRANING = 'wraning',
    SUCCESS = 'success',
    MASTER = 'master'
}

@ObjectType()
export class Notification extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field(() => ID)
    @Property({ required: true })
    userId: string

    @Field()
    @Property({ enum: ENotificationVarient, default: ENotificationVarient.INFO })
    varient: TNotificationVarient

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

    @Field()
    @Property({ default: false })
    read: boolean

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date

    static async sendNotification(data: INotification): Promise<void> {
        const notification = new NotificationModel({ ...data, read: false })
        await notification.save()
        await UserModel.findByIdAndUpdate(data.userId, { $push: { notifications: notification._id } })
    }

    static async markNotificationAsRead(_id: string): Promise<void> {
        await NotificationModel.findByIdAndUpdate(_id, { read: true })
    }

    static async findByUserId(userId: string, { skip, limit }: LoadmoreArgs): Promise<Notification[]> {
        const notifications = await NotificationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec()
        return notifications
    }
}

const NotificationModel = getModelForClass(Notification)

export default NotificationModel