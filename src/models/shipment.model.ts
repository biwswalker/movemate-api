import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import { User } from './user.model'
import { IsEnum } from 'class-validator'
import PrivilegeModel, { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { Schema } from 'mongoose'
import { File } from './file.model'
import { Location } from './location.model'
import { ShipmentAdditionalServicePrice } from './shipmentAdditionalServicePrice.model'
import { ShipmentDistancePricing } from './shipmentDistancePricing.model'
import { Payment } from './payment.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'
import { DirectionsResult } from './directionResult.model'
import { SubtotalCalculationArgs } from '@inputs/booking.input'
import VehicleCostModel from './vehicleCost.model'
import { get, min, sum } from 'lodash'
import { fNumber } from '@utils/formatNumber'
import AdditionalServiceCostPricingModel from './additionalServiceCostPricing.model'
import { SubtotalCalculatedPayload } from '@payloads/booking.payloads'

enum EShipingStatus {
  IDLE = 'idle',
  PROGRESSING = 'progressing',
  DELIVERED = 'dilivered',
  CANCELLED = 'cancelled',
  REFUND = 'refund',
}

enum EAdminAcceptanceStatus {
  PENDING = 'pending',
  REACH = 'reach',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

enum EDriverAcceptanceStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  UNINTERESTED = 'uninterested',
}

enum EShipingLogStatus {
  PENDING = 'pending',
  INPROGRESS = 'inprogress',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  COMPLETE = 'complete',
  REFUND = 'refund'
}

enum EIssueType {
  DELAY = 'DELAY',
  DAMAGE = 'DAMAGE',
  MISSING = 'MISSING',
  OTHER = 'OTHER',
}

@ObjectType()
export class ShipmentPODAddress {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  fullname: string

  @Field()
  @Property({ required: true })
  address: string

  @Field()
  @Property({ required: true })
  province: string;

  @Field()
  @Property({ required: true })
  district: string;

  @Field()
  @Property({ required: true })
  subDistrict: string;

  @Field()
  @Property({ required: true })
  postcode: string;

  @Field()
  @Property({ required: true })
  phoneNumber: string
}

@ObjectType()
export class StatusLog {
  @Field()
  @Property()
  text: string

  @Field()
  @IsEnum(EShipingLogStatus)
  @Property({ enum: EShipingLogStatus })
  status: TShipingLogStatus

  @Field()
  @Property({ default: Date.now })
  createdAt: Date
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
  @Property({ enum: EShipingStatus, default: EShipingStatus.IDLE })
  status: TShipingStatus

  @Field()
  @IsEnum(EAdminAcceptanceStatus)
  @Property({ enum: EAdminAcceptanceStatus, default: EAdminAcceptanceStatus.PENDING })
  adminAcceptanceStatus: TAdminAcceptanceStatus

  @Field()
  @IsEnum(EDriverAcceptanceStatus)
  @Property({ enum: EDriverAcceptanceStatus, default: EDriverAcceptanceStatus.IDLE })
  driverAcceptanceStatus: TDriverAcceptanceStatus

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
  directionId: Ref<DirectionsResult, string>

  @Field(() => [StatusLog], { nullable: true })
  @Property({ default: [], allowMixed: Severity.ALLOW })
  statusLog: StatusLog[]

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

  static async calculate({ vehicleTypeId, distanceMeter, dropPoint, isRounded, discountId, serviceIds }: SubtotalCalculationArgs): Promise<SubtotalCalculatedPayload> {
    try {
      const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId)
      const distanceKilometers = distanceMeter / 1000 // TODO: Recheck decimal calculation with owner
      const calculated = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: distanceKilometers, // TODO: Recheck decimal calculation with owner
        dropPoint,
        isRounded,
      })

      const vehicleName = get(vehicleCost, 'vehicleType.name', '')
      const distanceKM = fNumber(distanceKilometers, '0.0')

      const additionalservices = await AdditionalServiceCostPricingModel.getServicesPricing(serviceIds)

      let discountName = ''
      let totalDiscount = 0
      if (discountId) {
        const privilege = await PrivilegeModel.findById(discountId)
        if (privilege) {
          const { unit, discount, minPrice, maxDiscountPrice } = privilege
          const subTotal = sum([calculated.totalPrice, additionalservices.price])
          const isPercent = unit === 'percentage'
          if (subTotal >= minPrice) {
            if (isPercent) {
              const discountAsBath = (discount / 100) * subTotal
              const maxDiscountAsBath = maxDiscountPrice ? min([maxDiscountPrice, discountAsBath]) : discountAsBath
              totalDiscount = maxDiscountAsBath
            } else {
              totalDiscount = discount
            }
          } else {
            totalDiscount = 0
          }
          discountName = `${privilege.name} (${privilege.discount}${privilege.unit === 'currency' ? ' บาท' : privilege.unit === 'percentage' ? '%' : ''})`
        }
      }

      const total = sum([calculated.totalPrice, additionalservices.price, -totalDiscount])
      return {
        shippingPrices: [
          { label: `${vehicleName} (${distanceKM} กม.)`, price: calculated.subTotalPrice },
          ...(isRounded ? [{ label: 'ไป-กลับ', price: calculated.subTotalRoundedPrice }] : []),
        ],
        additionalServices: [
          ...(dropPoint > 1 ? [{ label: 'หลายจุดส่ง', price: calculated.subTotalDropPointPrice }] : []),
          ...additionalservices.priceItems,
        ],
        discounts: discountId ? [{ label: discountName, price: totalDiscount }] : [],
        total: total,
      }
    } catch (error) {
      throw error
    }
  }
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel
