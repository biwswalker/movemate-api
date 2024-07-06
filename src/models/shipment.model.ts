import { Field, ID, InputType, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, Ref, modelOptions, Severity } from '@typegoose/typegoose'
import { User } from "./user.model"
import { Payment } from "./payment.model"
import { IsEnum } from "class-validator"
import { Privilege } from "./privilege.model"
import { ShipmentPricing } from "./shipmentPricing.model"
import { Driver } from "./driver.model"
import { VehicleType } from "./vehicleType.model"

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
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class ShipmentRoute {
    @Field()
    name: string

    @Field({ nullable: true })
    start_coordinate: string

    @Field()
    destination_coordinate: string

    @Field({ nullable: true })
    distance: number

    @Field()
    contact_name: number

    @Field()
    contact_address: number

    @Field()
    contact_number: number
}

@ObjectType()
export class Shipment {
    @Field(() => ID)
    readonly _id: string;

    @Field()
    @Property({ required: true })
    book_date: Date;

    @Field({ nullable: true })
    @Property()
    accepted_driver_date: Date;

    @Field()
    @Property({ required: true })
    returned_route: boolean;

    @Field()
    @Property({ required: true })
    tracking_number: string;

    @Field()
    @IsEnum(EShipingStatus)
    @Property({ required: true, enum: EShipingStatus })
    status: TShipingStatus;

    @Field({ nullable: true })
    @IsEnum(EIssueType)
    @Property({ enum: EIssueType })
    issue_type: TIssueType;

    @Field({ nullable: true })
    @Property()
    issue_reason?: string;

    @Field(() => User)
    @Property({ ref: () => User, required: true })
    customer: Ref<User>

    @Field(() => VehicleType)
    @Property({ required: true, allowMixed: Severity.ALLOW })
    vehicle_type: Ref<VehicleType>

    @Field(() => Driver, { nullable: true })
    @Property({ allowMixed: Severity.ALLOW })
    driver: Ref<Driver>

    @Field()
    @Property({ required: true })
    origin: ShipmentRoute

    @Field(() => [ShipmentRoute])
    @Property({ required: true, allowMixed: Severity.ALLOW })
    destinations: ShipmentRoute[]

    @Field(() => ShipmentPricing)
    @Property({ ref: () => ShipmentPricing, required: true })
    shiping_pricing: Ref<ShipmentPricing>

    @Field()
    @Property({ required: true })
    handling_goods_driver: boolean;

    @Field()
    @Property({ required: true })
    handling_goods_labor: boolean;

    @Field()
    @Property({ required: true })
    pod_service: boolean;

    @Field()
    @Property({ required: true })
    hold_pickup: boolean;

    @Field(() => Payment)
    @Property({ ref: () => Payment, required: true })
    payment: Ref<Payment>

    @Field(() => Privilege, { nullable: true })
    @Property({ ref: () => Privilege })
    privilege: Ref<Privilege>

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel

@InputType()
export class DestinationInput {
    @Field()
    route_name: string

    @Field()
    point: string
}

@InputType()
export class RouteInput {
    @Field()
    name: string;

    @Field({ nullable: true })
    start_coordinate: string;

    @Field()
    destination_coordinate: string;

    @Field({ nullable: true })
    distance: number;

    @Field()
    contact_name: string;

    @Field()
    contact_address: string;

    @Field()
    contact_number: string;
}

@InputType()
export class ShipmentInput {
    @Field({ nullable: true })
    _id: string;

    @Field()
    book_date: Date;

    @Field()
    returned_route: boolean;

    @Field()
    customer: string; // Assuming customer ID

    @Field()
    vehicle_type: string;

    @Field()
    origin: RouteInput;

    @Field(() => [RouteInput])
    destinations: RouteInput[];

    @Field()
    shiping_pricing: string; // Assuming ShipmentPricing ID

    @Field()
    handling_goods_driver: boolean;

    @Field()
    handling_goods_labor: boolean;

    @Field()
    pod_service: boolean;

    @Field()
    hold_pickup: boolean;

    @Field()
    payment: string; // Assuming Payment ID

    @Field({ nullable: true })
    privilege: string; // Assuming Privilege ID
}