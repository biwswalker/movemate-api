import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import { User } from './user.model'
import { IsEnum } from 'class-validator'
import { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { Schema } from 'mongoose'
import { File } from './file.model'
import { DirectionsResult } from '@payloads/direction.payloads'
import { Location } from './location.model'
import { ShipmentAdditionalServicePrice } from './shipmentAdditionalServicePrice.model'
import { ShipmentDistancePricing } from './shipmentDistancePricing.model'
import { Payment } from './payment.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'

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
  contactNumber: string

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
}

@plugin(mongooseAutoPopulate)
@plugin(mongoosePagination)
@ObjectType()
export class Shipment extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  trackingNumber: string

  @Field()
  @IsEnum(EShipingStatus)
  @Property({ enum: EShipingStatus, default: EShipingStatus.PENDING })
  status: TShipingStatus

  @Field(() => User)
  @Property({ ref: () => User, required: true, autopopulate: true })
  customer: Ref<User>

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  requestedDriver: Ref<User>

  @Field(() => [Destination])
  @Property({ allowMixed: Severity.ALLOW })
  destinations: Destination[]

  @Field(() => Float)
  @Property()
  estimatedDistance: number

  @Field()
  @Property()
  estimatedTime: number

  @Field(() => Boolean)
  @Property()
  isRoundedReturn: boolean

  @Field(() => VehicleType)
  @Property({
    ref: () => VehicleType,
    type: Schema.Types.ObjectId,
    autopopulate: true,
  })
  vehicleId: Ref<VehicleType, string> // vehicle invoice

  @Field(() => [ShipmentAdditionalServicePrice])
  @Property({
    ref: () => ShipmentAdditionalServicePrice,
    type: Schema.Types.ObjectId,
    autopopulate: true,
  })
  additionalServices: Ref<ShipmentAdditionalServicePrice, string>[] // additional services invoice

  @Field(() => [ShipmentDistancePricing])
  @Property({ autopopulate: true, ref: () => ShipmentDistancePricing })
  distances: Ref<ShipmentDistancePricing>[]

  @Field(() => PODAddress, { nullable: true })
  @Property()
  podDetail?: PODAddress

  @Field(() => Privilege, { nullable: true })
  @Property({
    ref: () => Privilege,
    type: Schema.Types.ObjectId,
    autopopulate: true,
  })
  discountId?: Ref<Privilege, string>

  @Field()
  @Property()
  isBookingWithDate: boolean

  @Field({ nullable: true })
  @Property()
  bookingDateTime?: Date

  @Field(() => [File], { nullable: true })
  @Property({
    ref: () => File,
    type: Schema.Types.ObjectId,
    autopopulate: true,
  })
  additionalImages?: Ref<File, string>[]

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
    autopopulate: true,
  })
  directionId: Ref<DirectionsResult, string>

  // @Field({ nullable: true })
  // @IsEnum(EIssueType)
  // @Property({ enum: EIssueType })
  // issueType: TIssueType;

  // @Field({ nullable: true })
  // @Property()
  // issueReason?: string;

  @Field(() => Payment)
  @Property({ ref: () => Payment, required: true, autopopulate: true })
  payment: Ref<Payment>

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static paginate: mongoose.PaginateModel<typeof Shipment>['paginate']
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel
