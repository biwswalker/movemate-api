import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { IsEnum } from "class-validator"

enum EPaymentStatus {
    WAITING_FOR_WORK_COMPLETE = 'WAITING_FOR_WORK_COMPLETE',
    WAITING_FOR_PAYMENT = 'WAITING_FOR_PAYMENT',
    CANCELLED = 'CANCELLED',
    PAID = 'PAID',
}

@ObjectType()
export class Payment {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    amount: number

    @Field()
    @IsEnum(EPaymentStatus)
    @Property({ required: true, enum: EPaymentStatus, default: EPaymentStatus.WAITING_FOR_WORK_COMPLETE })
    status: TPaymentStatus

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const PaymentModel = getModelForClass(Payment)

export default PaymentModel