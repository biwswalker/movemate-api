import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import { User } from './user.model'
import { IsEnum } from 'class-validator'
import { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { Schema } from 'mongoose'
import { File } from './file.model'
import { ShipmentAdditionalServicePrice } from './shipmentAdditionalServicePrice.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'
import { DirectionsResult } from './directionResult.model'
import { StepDefinition } from './shipmentStepDefinition.model'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { UpdateHistory } from './updateHistory.model'
import { EPaymentMethod } from '@enums/payments'
import {
  EShipmentStatus,
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentCancellationReason,
} from '@enums/shipments'
import { DistanceCostPricing } from './distanceCostPricing.model'
import { Destination, ShipmentPODAddress } from './shipment/objects'
import { Quotation } from './finance/quotation.model'

@plugin(mongooseAutoPopulate)
@plugin(mongoosePagination)
@plugin(mongooseAggregatePaginate)
@ObjectType()
export class Shipment extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  trackingNumber: string

  @Field(() => EShipmentStatus)
  @IsEnum(EShipmentStatus)
  @Property({ enum: EShipmentStatus, default: EShipmentStatus.IDLE })
  status: EShipmentStatus

  @Field(() => EAdminAcceptanceStatus)
  @IsEnum(EAdminAcceptanceStatus)
  @Property({ enum: EAdminAcceptanceStatus, default: EAdminAcceptanceStatus.PENDING })
  adminAcceptanceStatus: EAdminAcceptanceStatus

  @Field(() => EDriverAcceptanceStatus)
  @IsEnum(EDriverAcceptanceStatus)
  @Property({ enum: EDriverAcceptanceStatus, default: EDriverAcceptanceStatus.IDLE })
  driverAcceptanceStatus: EDriverAcceptanceStatus

  @Field(() => User)
  @Property({ ref: () => User, required: true, autopopulate: true })
  customer: Ref<User>

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  requestedDriver: Ref<User>

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  driver: Ref<User>

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  agentDriver: Ref<User>

  @Field(() => [Destination])
  @Property({ allowMixed: Severity.ALLOW })
  destinations: Destination[]

  @Field(() => Float)
  @Property()
  displayDistance: number

  @Field()
  @Property()
  displayTime: number

  @Field(() => Float)
  @Property()
  distance: number

  @Field(() => Float)
  @Property()
  returnDistance: number

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

  @Field(() => ShipmentPODAddress, { nullable: true })
  @Property()
  podDetail?: ShipmentPODAddress

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
  route: Ref<DirectionsResult, string>

  @Field(() => [StepDefinition], { defaultValue: [] })
  @Property({ ref: () => StepDefinition, default: [], autopopulate: true })
  steps: Ref<StepDefinition>[]

  @Field(() => Int)
  @Property({ default: 0 })
  currentStepSeq: number

  @Field(() => EPaymentMethod)
  @Property()
  paymentMethod: EPaymentMethod

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => [UpdateHistory], { nullable: true })
  @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
  history: Ref<UpdateHistory>[]

  @Field(() => String, { nullable: true })
  @IsEnum(EShipmentCancellationReason)
  @Property({ enum: EShipmentCancellationReason, required: false })
  cancellationReason: EShipmentCancellationReason

  @Field(() => String, { nullable: true })
  @Property({ required: false })
  cancellationDetail: string

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  deliveredDate?: Date

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  cancelledDate?: Date

  @Field(() => Float, { nullable: true })
  @Property({ required: true, default: 0 })
  cancellationFee: number // ค่าปรับจากการยกเลิกที่ลูกค้าต้องจ่าย

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  cancellationBy: Ref<User>

  @Field({ defaultValue: 0 })
  @Property({ required: false, default: 0 })
  notificationCount?: number

  @Field({ defaultValue: false })
  @Property({ required: false, default: false })
  isNotificationPause?: boolean

  @Field(() => [DistanceCostPricing], { defaultValue: [] })
  @Property({ allowMixed: Severity.ALLOW, default: [] })
  formula: DistanceCostPricing[]

  @Field(() => [Quotation], { defaultValue: [] })
  @Property({ ref: () => Quotation, autopopulate: true, default: [] })
  quotations: Ref<Quotation>[]

  static paginate: mongoose.PaginateModel<typeof Shipment>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof Shipment>['aggregatePaginate']
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel
