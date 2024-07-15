import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { IsEnum } from "class-validator"
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { SubtotalCalculatedPayload } from "@payloads/booking.payloads"
import { File } from "./file.model"

enum EPaymentMethod {
    CASH = 'cash',
    CREDIT = 'credit'
}

enum EPaymentStatus {
    WAITING_CONFIRM_PAYMENT = 'WAITING_CONFIRM_PAYMENT',
    INVOICE = 'INVOICE',
    PAID = 'PAID',
    CANCELLED = 'CANCELLED',
}

@ObjectType()
export class InvoiceDetail {
    @Field()
    @Property()
    name: string

    @Field()
    @Property()
    address: string

    @Field()
    @Property()
    province: string

    @Field()
    @Property()
    district: string

    @Field()
    @Property()
    subDistrict: string

    @Field()
    @Property()
    postcode: string

    @Field()
    @Property()
    contactNumber: string
}

@ObjectType()
export class CashDetail {
    @Field(() => File)
    @Property({ ref: () => File })
    imageEvidence: Ref<File, string>

    @Field()
    @Property()
    bank: string

    @Field()
    @Property()
    bankName: string

    @Field()
    @Property()
    bankNumber: string

    @Field(() => Date)
    @Property()
    paymentDate: Date

    @Field(() => Date)
    @Property()
    paymentTime: Date
}

@ObjectType()
export class Payment extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsEnum(EPaymentStatus)
    @Property({ enum: EPaymentStatus, default: EPaymentStatus.WAITING_CONFIRM_PAYMENT })
    status: TPaymentStatus

    @Field(() => String)
    @IsEnum(EPaymentMethod)
    @Property({ enum: EPaymentMethod, default: EPaymentMethod.CASH, required: true })
    paymentMethod: TPaymentMethod

    @Field(() => InvoiceDetail, { nullable: true })
    @Property({ required: false })
    invoiceDetail?: InvoiceDetail

    @Field(() => CashDetail, { nullable: true })
    @Property({ required: false })
    cashDetail?: CashDetail

    @Field(() => CashDetail, { nullable: true })
    @Property({ required: false })
    detail: SubtotalCalculatedPayload

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const PaymentModel = getModelForClass(Payment)

export default PaymentModel