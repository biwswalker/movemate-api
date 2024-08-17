import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import { User } from './user.model'
import { IsEnum } from 'class-validator'
import PrivilegeModel, { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { Schema } from 'mongoose'
import FileModel, { File } from './file.model'
import { Location } from './location.model'
import { ShipmentAdditionalServicePrice } from './shipmentAdditionalServicePrice.model'
import { ShipmentDistancePricing } from './shipmentDistancePricing.model'
import { Payment } from './payment.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'
import { DirectionsResult } from './directionResult.model'
import { SubtotalCalculationArgs } from '@inputs/booking.input'
import VehicleCostModel from './vehicleCost.model'
import lodash, { filter, find, flatten, get, isEqual, map, min, range, sum, values } from 'lodash'
import { fNumber } from '@utils/formatNumber'
import AdditionalServiceCostPricingModel from './additionalServiceCostPricing.model'
import { SubtotalCalculatedPayload } from '@payloads/booking.payloads'
import StepDefinitionModel, { EStepDefinition, EStepDefinitionName, EStepStatus, StepDefinition } from './shipmentStepDefinition.model'
import { FileInput } from '@inputs/file.input'
import Aigle from 'aigle'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'

Aigle.mixin(lodash, {});

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

  @Field({ nullable: true })
  @Property()
  remark: string
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
@plugin(mongooseAggregatePaginate)
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

  @Field({ nullable: true })
  @Property({ default: false })
  requestedDriverAccepted: boolean

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  driver: Ref<User>

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

  @Field(() => [StepDefinition], { defaultValue: [] })
  @Property({ ref: () => StepDefinition, default: [], autopopulate: true })
  steps: Ref<StepDefinition>[]

  @Field(() => Int)
  @Property({ default: 0 })
  currentStepSeq: number

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
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof Shipment>['aggregatePaginate']

  static async calculate({ vehicleTypeId, distanceMeter, distanceReturnMeter, dropPoint, isRounded, discountId, serviceIds }: SubtotalCalculationArgs): Promise<SubtotalCalculatedPayload> {
    try {
      const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId)
      const distanceKilometers = distanceMeter / 1000 // TODO: Recheck decimal calculation with owner
      const distanceReturnKilometers = distanceReturnMeter / 1000 // TODO: Recheck decimal calculation with owner
      const calculated = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: distanceKilometers, // TODO: Recheck decimal calculation with owner
        returnedDistance: distanceReturnKilometers,
        dropPoint,
        isRounded,
      })

      const vehicleName = get(vehicleCost, 'vehicleType.name', '')
      const distanceKM = fNumber(distanceKilometers, '0.0')
      const distanceReturnKM = fNumber(distanceReturnKilometers, '0.0')

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
          ...(isRounded ? [{ label: `ไป-กลับ ${calculated.roundedPricePercent}% (${distanceReturnKM} กม.)`, price: calculated.subTotalRoundedPrice }] : []),
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

  // 'CASH_VERIFY' | 'DRIVER_ACCEPTED' | 'CONFIRM_DATETIME' | 'ARRIVAL_PICKUP_LOCATION' | 'PICKUP' | 'ARRIVAL_DROPOFF' | 'DROPOFF' | 'POD' | 'FINISH'
  async initialStepDefinition(): Promise<boolean> {
    console.log('this: ', JSON.stringify(this))
    const shipmentId = get(this, '_doc._id', []) || get(this, '_id', [])
    const destinations = get(this, '_doc.destinations', []) || get(this, 'destinations', [])
    const dropoffLength = destinations.length - 1
    const additionalServices = get(this, '_doc.additionalServices', []) || get(this, 'additionalServices', [])
    const podServiceRaws = filter(additionalServices, (service) => {
      const name = get(service, 'reference.additionalService.name', '')
      return isEqual(name, 'POD')
    })
    const isPODService = podServiceRaws.length > 0
    const paymentMethod = get(this, '_doc.payment.paymentMethod', '') || get(this, 'payment.paymentMethod', '')
    const isCashMethod = isEqual(paymentMethod, 'cash')
    const bulkOperations = [
      {
        insertOne: {
          document: {
            step: EStepDefinition.CREATED,
            seq: 0,
            stepName: EStepDefinitionName.CREATED,
            customerMessage: 'งานเข้าระบบ',
            driverMessage: '',
            stepStatus: EStepStatus.DONE,
          },
        },
      },
      ...(isCashMethod ? [{
        insertOne: {
          document: {
            step: EStepDefinition.CASH_VERIFY,
            seq: 0,
            stepName: EStepDefinitionName.CASH_VERIFY,
            customerMessage: 'ยืนยันการชำระเงิน',
            driverMessage: '',
            stepStatus: EStepStatus.PROGRESSING,
          },
        },
      }] : []),
      {
        insertOne: {
          document: {
            step: EStepDefinition.DRIVER_ACCEPTED,
            seq: 0,
            stepName: EStepDefinitionName.DRIVER_ACCEPTED,
            customerMessage: 'รอคนขับตอบรับ',
            driverMessage: '',
            stepStatus: isCashMethod ? EStepStatus.IDLE : EStepStatus.PROGRESSING,
          },
        },
      },
      {
        insertOne: {
          document: {
            step: EStepDefinition.CONFIRM_DATETIME,
            seq: 0,
            stepName: EStepDefinitionName.CONFIRM_DATETIME,
            customerMessage: 'นัดหมายและยืนยันเวลา',
            driverMessage: 'นัดหมายและยืนยันเวลา',
            stepStatus: EStepStatus.IDLE,
          },
        },
      },
      {
        insertOne: {
          document: {
            step: EStepDefinition.ARRIVAL_PICKUP_LOCATION,
            seq: 0,
            stepName: EStepDefinitionName.ARRIVAL_PICKUP_LOCATION,
            customerMessage: 'ถึงจุดรับสินค้า',
            driverMessage: 'จุดรับสินค้า',
            stepStatus: EStepStatus.IDLE,
          },
        },
      },
      {
        insertOne: {
          document: {
            step: EStepDefinition.PICKUP,
            seq: 0,
            stepName: EStepDefinitionName.PICKUP,
            customerMessage: 'ขึ้นสินค้าที่จุดรับสินค้า',
            driverMessage: 'ขึ้นสินค้าที่จุดรับสินค้า',
            stepStatus: EStepStatus.IDLE,
          },
        },
      },
      ...flatten(map(range(1, dropoffLength + 1), (seq, index) => {
        return [
          {
            insertOne: {
              document: {
                step: EStepDefinition.ARRIVAL_DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
                customerMessage: dropoffLength > 1 ? `ถึงจุดส่งสินค้าที่ ${seq}` : 'ถึงจุดส่งสินค้า',
                driverMessage: dropoffLength > 1 ? `ถึงจุดส่งสินค้าที่ ${seq}` : 'ถึงจุดส่งสินค้า',
                stepStatus: EStepStatus.IDLE,
              },
            },
          },
          {
            insertOne: {
              document: {
                step: EStepDefinition.DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.DROPOFF,
                customerMessage: dropoffLength > 1 ? `จัดส่งสินค้าจุดที่ ${seq}` : 'จัดส่งสินค้า',
                driverMessage: dropoffLength > 1 ? `จัดส่งสินค้าจุดที่ ${seq}` : 'จัดส่งสินค้า',
                stepStatus: EStepStatus.IDLE,
              },
            },
          },
        ]
      })),
      {
        insertOne: {
          document: {
            step: EStepDefinition.FINISH,
            seq: 0,
            stepName: EStepDefinitionName.FINISH,
            customerMessage: 'จัดส่งสำเร็จ',
            driverMessage: 'จัดส่งสำเร็จ',
            stepStatus: EStepStatus.IDLE,
          },
        },
      },
      ...(isPODService ? [{
        insertOne: {
          document: {
            step: EStepDefinition.POD,
            seq: 0,
            stepName: EStepDefinitionName.POD,
            customerMessage: 'แนบเอกสารและส่งเอกสาร POD',
            driverMessage: 'แนบเอกสารและส่งเอกสาร POD',
            stepStatus: EStepStatus.IDLE,
          },
        },
      }] : [])
    ];

    const reSequenceBulkOperation = map(bulkOperations, ({ insertOne: { document } }, index) => ({
      insertOne: {
        document: {
          ...document,
          seq: index,
        },
      },
    }))

    const stepDefinitionResult = await StepDefinitionModel.bulkWrite(reSequenceBulkOperation);
    const _stepDefinitionIds = values(stepDefinitionResult.insertedIds)
    await ShipmentModel.findByIdAndUpdate(shipmentId, { steps: _stepDefinitionIds, currentStepSeq: 1 })

    return true
  }

  async nextStep(images?: FileInput[]): Promise<boolean> {
    try {

      const currentStep = find(this.steps, ['seq', this.currentStepSeq])
      const uploadedFiles = await Aigle.map(images, async (image) => {
        const fileModel = new FileModel(image)
        await fileModel.save()
        const file = await FileModel.findById(fileModel._id)
        return file
      })
      const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
      await stepDefinitionModel.updateOne({
        stepStatus: EStepStatus.DONE,
        images: uploadedFiles,
        updatedAt: new Date()
      })
      const nextStepDeifinition = find(this.steps, ['seq', this.currentStepSeq + 1])
      const nextStepId = get(nextStepDeifinition, '_id', '')
      if (nextStepId) {
        const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)

        // --- IF Final step ---
        if (nextStepDefinitionModel.step === 'FINISH') {
          const nextPODStep = find(this.steps, ['seq', nextStepDefinitionModel.seq + 1])
          const nextPODStepId = get(nextPODStep, '_id', '')
          if (nextPODStepId) {
            const podStepDefinitionModel = await StepDefinitionModel.findById(nextPODStepId)
            await podStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() })
            await ShipmentModel.findByIdAndUpdate(this._id, { currentStepSeq: podStepDefinitionModel.seq })
          } else {
            // True mean final step
            // Set final

            await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.DONE, updatedAt: new Date() })
            await ShipmentModel.findByIdAndUpdate(this._id, { currentStepSeq: nextStepDefinitionModel.seq, driverAcceptanceStatus: 'accepted', status: 'dilivered' })
            return true
          }
          // --- IF Final step ---
        } else if (nextStepDefinitionModel.step === 'POD') {
          // Final
          await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.DONE, updatedAt: new Date() })
          await ShipmentModel.findByIdAndUpdate(this._id, { currentStepSeq: nextStepDefinitionModel.seq, driverAcceptanceStatus: 'accepted', status: 'dilivered' })
          // True mean final step
          return true
        } else {
          // --- Continue if not success ---
          await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() })
          await ShipmentModel.findByIdAndUpdate(this._id, { currentStepSeq: nextStepDefinitionModel.seq })
        }
      }
      return false
    } catch (error) {
      throw error
    }
  }

  async markAsDone() {
    console.log('markAsDone: ', this.status)
  }
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel