import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, Ref, Severity } from '@typegoose/typegoose'
import { User } from "./user.model"
import { IsEnum } from "class-validator"
import { Privilege } from "./privilege.model"
import { VehicleType } from "./vehicleType.model"
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { Schema } from "mongoose"
import { AdditionalServiceCostPricing } from "./additionalServiceCostPricing.model"
import { File } from "./file.model"
import { DirectionsResult } from "@payloads/direction.payloads"
import { Location } from "./location.model"

enum TPaymentMethod {
    CASH = 'cash',
    CREDIT = 'credit'
}

enum EShipingStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

enum EIssueType {
    DELAY = 'DELAY',
    DAMAGE = 'DAMAGE',
    MISSING = 'MISSING',
    OTHER = 'OTHER',
}

@ObjectType()
export class Destination {
    @Field()
    @Property()
    placeId: string

    @Field()
    @Property()
    name: string

    @Field()
    @Property()
    detail: string

    @Field(() => Location)
    @Property()
    location: Location

    @Field()
    @Property()
    contactName: string

    @Field()
    @Property()
    contectNumber: string

    @Field({ nullable: true })
    @Property()
    customerRemark: string
}

@ObjectType()
export class PODAddress {
    @Field({ nullable: true })
    @Property()
    _id?: string

    @Field()
    @Property()
    fullname: string

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
    phoneNumber: string

    @Field()
    @Property()
    saveFavorite?: boolean
}

@ObjectType()
export class PaymentDetail {
    @Field()
    _id?: string

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
export class CashPaymentDetail {
    @Field()
    _id?: string

    @Field(() => File)
    @Property({ ref: () => File })
    imageEvidence: Ref<File>

    @Field()
    @Property()
    bank: string

    @Field()
    @Property()
    bankName: string

    @Field()
    @Property()
    bankNumber: string

    @Field()
    @Property()
    paymentDate: string

    @Field()
    @Property()
    paymentTime: string
}

@ObjectType()
export class Shipment extends TimeStamps {
    @Field(() => ID)
    readonly _id: string;

    @Field()
    @Property({ required: true })
    trackingNumber: string;

    @Field()
    @IsEnum(EShipingStatus)
    @Property({ required: true, enum: EShipingStatus })
    status: TShipingStatus;

    @Field(() => User)
    @Property({ ref: () => User, required: true })
    customer: Ref<User>

    @Field(() => [Destination])
    @Property({ allowMixed: Severity.ALLOW })
    destinations: Destination[]

    @Field(() => Float)
    @Property()
    estimatedDistance: number

    @Field()
    @Property()
    estimatedTime: number


    @Field()
    isRoundedReturn: boolean

    @Field(() => VehicleType)
    @Property({
        ref: () => VehicleType,
        type: Schema.Types.ObjectId,
    })
    vehicleId: Ref<VehicleType, string>

    @Field(() => [AdditionalServiceCostPricing])
    @Property({
        ref: () => AdditionalServiceCostPricing,
        type: Schema.Types.ObjectId,
    })
    additionalServices: Ref<AdditionalServiceCostPricing, string>[]

    @Field(() => PODAddress, { nullable: true })
    @Property()
    podDetail?: PODAddress

    @Field(() => String)
    @IsEnum(TPaymentMethod)
    @Property({ enum: TPaymentMethod, default: TPaymentMethod.CASH, required: true })
    paymentMethod: TPaymentMethod;

    @Field(() => PaymentDetail, { nullable: true })
    @Property()
    paymentDetail?: PaymentDetail;

    @Field(() => CashPaymentDetail, { nullable: true })
    @Property()
    cashPaymentDetail?: CashPaymentDetail;

    @Field(() => Privilege, { nullable: true })
    @Property({
        ref: () => Privilege,
        type: Schema.Types.ObjectId,
    })
    discountCode?: Ref<Privilege, string>;

    @Field()
    @Property()
    isBookingWithDate: boolean;

    @Field()
    @Property()
    bookingDateTime: Date;

    @Field(() => [File], { nullable: true })
    @Property({
        ref: () => File,
        type: Schema.Types.ObjectId,
    })
    additionalImage?: Ref<File, string>[]

    @Field({ nullable: true })
    @Property()
    refId?: string

    @Field({ nullable: true })
    @Property()
    remark?: string

    @Field(() => DirectionsResult)
    @Property({
        ref: () => DirectionsResult,
        type: Schema.Types.ObjectId,
    })
    directionId: Ref<DirectionsResult, string>

    // @Field({ nullable: true })
    // @IsEnum(EIssueType)
    // @Property({ enum: EIssueType })
    // issueType: TIssueType;

    // @Field({ nullable: true })
    // @Property()
    // issueReason?: string;

    // @Field(() => ShipmentPricing)
    // @Property({ ref: () => ShipmentPricing, required: true })
    // shiping_pricing: Ref<ShipmentPricing>

    // @Field(() => Payment)
    // @Property({ ref: () => Payment, required: true })
    // payment: Ref<Payment>

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel
