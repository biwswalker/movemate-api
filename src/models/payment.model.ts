import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from "class-validator"
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { File } from "./file.model"
import { PricingCalculationMethodPayload } from "@payloads/pricing.payloads"
import { SubtotalCalculatedPayload } from "@payloads/booking.payloads"
import mongooseAutoPopulate from "mongoose-autopopulate"
import { UpdateHistory } from "./updateHistory.model"

export enum EPaymentMethod {
    CASH = 'cash',
    CREDIT = 'credit'
}

export enum EPaymentStatus {
    WAITING_CONFIRM_PAYMENT = 'waiting_confirm_payment',
    INVOICE = 'invoice',
    BILLED = 'billed',
    PAID = 'paid',
    REFUNDED = 'refunded',
    REFUND = 'refund',
}

export enum EPaymentRejectionReason {
    INSUFFICIENT_FUNDS = 'insufficient_funds',
    UNABLE_VERIFY_EVIDENCE = 'unable_verify_evidence',
    OTHER = 'other',
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

@plugin(mongooseAutoPopulate)
@ObjectType()
export class CashDetail {
    @Field(() => File)
    @Property({ ref: () => File, autopopulate: true })
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

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Payment extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property()
    paymentNumber: string

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
    creditDetail?: InvoiceDetail

    @Field(() => CashDetail, { nullable: true })
    @Property({ required: false })
    cashDetail?: CashDetail

    @Field(() => PricingCalculationMethodPayload, { nullable: true })
    @Property({ required: false })
    calculation: PricingCalculationMethodPayload

    @Field(() => SubtotalCalculatedPayload, { nullable: true })
    @Property({ required: false })
    invoice: SubtotalCalculatedPayload

    @Field(() => String, { nullable: true })
    @IsEnum(EPaymentRejectionReason)
    @Property({ enum: EPaymentRejectionReason, required: false })
    rejectionReason: TPaymentRejectionReason

    @Field(() => String, { nullable: true })
    @Property({ required: false })
    rejectionOtherReason: string

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date

    @Field(() => [UpdateHistory], { nullable: true })
    @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
    history: Ref<UpdateHistory>[];
}

const PaymentModel = getModelForClass(Payment)

export default PaymentModel