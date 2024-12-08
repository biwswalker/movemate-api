import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import UserModel, { User } from './user.model'
import { IsEnum } from 'class-validator'
import PrivilegeModel, { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { AnyBulkWriteOperation, FilterQuery, Schema, Types } from 'mongoose'
import FileModel, { File } from './file.model'
import { Location } from './location.model'
import ShipmentAdditionalServicePriceModel, {
  ShipmentAdditionalServicePrice,
} from './shipmentAdditionalServicePrice.model'
import { ShipmentDistancePricing } from './shipmentDistancePricing.model'
import PaymentModel, { Payment } from './payment.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'
import { DirectionsResult } from './directionResult.model'
import { CalculationExistingArgs, SubtotalCalculationArgs } from '@inputs/booking.input'
import VehicleCostModel from './vehicleCost.model'
import lodash, {
  filter,
  find,
  flatten,
  forEach,
  get,
  head,
  isEmpty,
  isEqual,
  last,
  map,
  min,
  omitBy,
  random,
  range,
  reduce,
  sortBy,
  sum,
  tail,
  union,
  uniq,
  values,
} from 'lodash'
import { fNumber } from '@utils/formatNumber'
import AdditionalServiceCostPricingModel, { AdditionalServiceCostPricing } from './additionalServiceCostPricing.model'
import { PriceItem, SubtotalCalculatedPayload } from '@payloads/booking.payloads'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from './shipmentStepDefinition.model'
import { FileInput } from '@inputs/file.input'
import Aigle from 'aigle'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import { Refund } from './refund.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import NotificationModel, { ENotificationVarient } from './notification.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from './transaction.model'
import DriverDetailModel from './driverDetail.model'
import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import {
  EShipmentStatus,
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentCancellationReason,
  EShipmentMatchingCriteria,
} from '@enums/shipments'
import { addSeconds } from 'date-fns'
import { EDriverStatus, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { EPrivilegeDiscountUnit } from '@enums/privilege'
import { GraphQLJSONObject } from 'graphql-type-json'
import { extractThaiAddress, getPlaceDetail, getRoute } from '@services/maps/location'
import { DistanceCostPricing, EDistanceCostPricingUnit } from './distanceCostPricing.model'
import { CalculationResultPayload, PricingCalculationMethodPayload } from '@payloads/pricing.payloads'
import { AdditionalService } from './additionalService.model'
import { DestinationInput } from '@inputs/shipment.input'
import { generateTrackingNumber } from '@utils/string.utils'

Aigle.mixin(lodash, {})

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
  province: string

  @Field()
  @Property({ required: true })
  district: string

  @Field()
  @Property({ required: true })
  subDistrict: string

  @Field()
  @Property({ required: true })
  postcode: string

  @Field()
  @Property({ required: true })
  phoneNumber: string

  @Field({ nullable: true })
  @Property()
  remark: string

  @Field({ nullable: true })
  @Property()
  trackingNumber?: string

  @Field({ nullable: true })
  @Property()
  provider?: string
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

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property()
  placeDetail: Record<string, any>

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeProvince: string

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeDistrict: string

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeSubDistrict: string
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

  @Field(() => Payment)
  @Property({ ref: () => Payment, required: true, autopopulate: true })
  payment: Ref<Payment>

  @Field(() => [Payment])
  @Property({ ref: () => Payment, autopopulate: true })
  paymentOlds: Ref<Payment>[]

  @Field(() => Refund, { nullable: true })
  @Property({ ref: () => Refund, required: false, autopopulate: true })
  refund?: Ref<Refund>

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

  @Field({ defaultValue: 0 })
  @Property({ required: false, default: 0 })
  notificationCount?: number

  @Field({ defaultValue: false })
  @Property({ required: false, default: false })
  isNotificationPause?: boolean

  static paginate: mongoose.PaginateModel<typeof Shipment>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof Shipment>['aggregatePaginate']

  static async calculate(
    {
      vehicleTypeId,
      distanceMeter,
      distanceReturnMeter,
      dropPoint,
      isRounded,
      discountId,
      serviceIds,
      isBusinessCashPayment,
    }: SubtotalCalculationArgs,
    costCalculation: boolean = false,
  ): Promise<SubtotalCalculatedPayload> {
    try {
      const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId)
      const distanceKilometers = distanceMeter / 1000 // as KM.
      const distanceReturnKilometers = distanceReturnMeter / 1000 // as KM.
      const calculated = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: distanceKilometers,
        returnedDistance: distanceReturnKilometers,
        dropPoint,
        isRounded,
      })

      const vehicleName = get(vehicleCost, 'vehicleType.name', '')
      const distanceKM = fNumber(distanceKilometers, '0.0')
      const distanceReturnKM = fNumber(distanceReturnKilometers, '0.0')

      // Additional Services
      const additionalservices = await AdditionalServiceCostPricingModel.getServicesPricing(serviceIds, costCalculation)

      // Privilege
      let discountName = ''
      let totalDiscount = 0
      if (discountId) {
        const privilege = await PrivilegeModel.findById(discountId)
        if (privilege) {
          const { unit, discount, minPrice, maxDiscountPrice } = privilege
          const subTotal = sum([calculated.totalPrice, additionalservices.price])
          const isPercent = unit === EPrivilegeDiscountUnit.PERCENTAGE
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
          discountName = `${privilege.name} (${privilege.discount}${
            privilege.unit === EPrivilegeDiscountUnit.CURRENCY
              ? ' บาท'
              : privilege.unit === EPrivilegeDiscountUnit.PERCENTAGE
              ? '%'
              : ''
          })`
        }
      }

      const subTotalCost = sum([calculated.totalCost, additionalservices.cost])
      const subTotalPrice = sum([calculated.totalPrice, additionalservices.price, -totalDiscount])

      /**
       * งานเงินสด
       * บริษัท
       * - แสดงและคำนวณ WHT ทุกครั้ง และแสดงทุกครั้ง
       * (ค่าขนส่งเกิน 1000 คิด WHT 1%)
       * (ค่าขนส่งน้อยกว่า 1000 คิดราคาเต็ม)
       */
      let whtName = ''
      let wht = 0
      const isTaxCalculation = isBusinessCashPayment && subTotalPrice > 1000
      if (isTaxCalculation) {
        whtName = 'ค่าภาษีบริการขนส่งสินค้าจากบริษัท 1% (WHT)'
        wht = subTotalPrice * 0.01
      }

      const totalCost = sum([subTotalCost])
      const totalPrice = sum([subTotalPrice, -wht])
      return {
        shippingPrices: [
          {
            label: `${vehicleName} (${fNumber(distanceKM)} กม.)`,
            price: calculated.subTotalPrice,
            cost: costCalculation ? calculated.subTotalCost : 0,
          },
          ...(isRounded
            ? [
                {
                  label: `ไป-กลับ ${calculated.roundedPricePercent}% (${distanceReturnKM} กม.)`,
                  price: calculated.subTotalRoundedPrice,
                  cost: costCalculation ? calculated.subTotalRoundedCost : 0,
                },
              ]
            : []),
        ],
        additionalServices: [
          ...(dropPoint > 1
            ? [
                {
                  label: 'หลายจุดส่ง',
                  price: calculated.subTotalDropPointPrice,
                  cost: costCalculation ? calculated.subTotalDropPointCost : 0,
                },
              ]
            : []),
          ...additionalservices.priceItems,
        ],
        discounts: discountId ? [{ label: discountName, price: totalDiscount, cost: 0 }] : [],
        taxs: isTaxCalculation ? [{ label: whtName, price: wht, cost: 0 }] : [],
        subTotalCost: costCalculation ? subTotalCost : 0,
        subTotalPrice: subTotalPrice,
        totalCost: costCalculation ? totalCost : 0,
        totalPrice: totalPrice,
      }
    } catch (error) {
      throw error
    }
  }

  async initialStepDefinition(isReMatching: boolean = false): Promise<boolean> {
    // TODO: Remove this comment
    // const shipmentId = get(this, '_doc._id', []) || get(this, '_id', [])
    // const isReturn = get(this, '_doc.isRoundedReturn', false) || get(this, 'isRoundedReturn', false)
    // const destinations = get(this, '_doc.destinations', []) || get(this, 'destinations', [])
    // const additionalServices = get(this, '_doc.additionalServices', []) || get(this, 'additionalServices', [])
    // const paymentMethod = get(this, '_doc.payment.paymentMethod', '') || get(this, 'payment.paymentMethod', '')
    const dropoffLength = this.destinations.length - 1
    const podServiceRaws = filter(this.additionalServices, (service) => {
      const name = get(service, 'reference.additionalService.name', '')
      return isEqual(name, 'POD')
    })
    const isPODService = podServiceRaws.length > 0
    const paymentMethod = get(this, 'payment.paymentMethod', '')
    const isCashMethod = isEqual(paymentMethod, EPaymentMethod.CASH)
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
      ...(isCashMethod
        ? [
            {
              insertOne: {
                document: {
                  step: EStepDefinition.CASH_VERIFY,
                  seq: 0,
                  stepName: EStepDefinitionName.CASH_VERIFY,
                  customerMessage: 'ยืนยันการชำระเงิน',
                  driverMessage: '',
                  stepStatus: isReMatching ? EStepStatus.DONE : EStepStatus.PROGRESSING,
                },
              },
            },
          ]
        : []),
      {
        insertOne: {
          document: {
            step: EStepDefinition.DRIVER_ACCEPTED,
            seq: 0,
            stepName: EStepDefinitionName.DRIVER_ACCEPTED,
            customerMessage: 'รอคนขับตอบรับ',
            driverMessage: '',
            stepStatus: isCashMethod
              ? isReMatching
                ? EStepStatus.PROGRESSING
                : EStepStatus.IDLE
              : EStepStatus.PROGRESSING,
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
      ...flatten(
        map(range(1, dropoffLength + 1), (seq, index) => {
          const isMultiple = dropoffLength > 1
          const isLatest = index >= dropoffLength - 1
          return [
            {
              insertOne: {
                document: {
                  step: EStepDefinition.ARRIVAL_DROPOFF,
                  seq: 0,
                  stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
                  customerMessage: isMultiple ? `ถึงจุดส่งสินค้าที่ ${seq}` : 'ถึงจุดส่งสินค้า',
                  driverMessage: isMultiple
                    ? `จุดส่งสินค้าที่ ${seq}${isLatest ? ' (จุดสุดท้าย)' : ''}`
                    : 'จุดส่งสินค้า',
                  stepStatus: EStepStatus.IDLE,
                  meta: seq,
                },
              },
            },
            {
              insertOne: {
                document: {
                  step: EStepDefinition.DROPOFF,
                  seq: 0,
                  stepName: EStepDefinitionName.DROPOFF,
                  customerMessage: isMultiple ? `จัดส่งสินค้าจุดที่ ${seq}` : 'จัดส่งสินค้า',
                  driverMessage: isMultiple
                    ? `จุดส่งสินค้าที่ ${seq}${isLatest ? ' (จุดสุดท้าย)' : ''}`
                    : 'จุดส่งสินค้า',
                  stepStatus: EStepStatus.IDLE,
                  meta: seq,
                },
              },
            },
          ]
        }),
      ),
      ...(this.isRoundedReturn
        ? [
            {
              insertOne: {
                document: {
                  step: EStepDefinition.ARRIVAL_DROPOFF,
                  seq: 0,
                  stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
                  customerMessage: 'ถึงจุดส่งสินค้ากลับ',
                  driverMessage: 'จุดส่งสินค้า(กลับไปยังต้นทาง)',
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
                  customerMessage: 'จัดส่งสินค้ากลับ',
                  driverMessage: 'จุดส่งสินค้า (กลับไปยังต้นทาง)',
                  stepStatus: EStepStatus.IDLE,
                },
              },
            },
          ]
        : []),
      ...(isPODService
        ? [
            {
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
            },
          ]
        : []),
      {
        insertOne: {
          document: {
            step: EStepDefinition.FINISH,
            seq: 0,
            stepName: EStepDefinitionName.FINISH,
            customerMessage: 'รอยืนยันการจบงาน',
            driverMessage: 'ยืนยันการจัดส่งสำเร็จ',
            stepStatus: EStepStatus.IDLE,
          },
        },
      },
    ]

    const reSequenceBulkOperation = map(bulkOperations, ({ insertOne: { document } }, index) => ({
      insertOne: {
        document: {
          ...document,
          seq: index,
        },
      },
    }))

    const stepDefinitionResult = await StepDefinitionModel.bulkWrite(reSequenceBulkOperation)
    const _stepDefinitionIds = values(stepDefinitionResult.insertedIds)
    await ShipmentModel.findByIdAndUpdate(this._id, {
      steps: _stepDefinitionIds,
      currentStepSeq: isReMatching ? (isCashMethod ? 2 : 1) : 1,
    })

    return true
  }

  async addStep(data: StepDefinition): Promise<boolean> {
    try {
      let newStep = []
      console.log('Start Step: ')
      await Aigle.forEach(this.steps, async (step, index) => {
        const currentStepId = get(step, '_id', '')
        if (index < data.seq) {
          newStep.push(currentStepId)
          console.log(index, currentStepId)
        } else if (data.seq === index) {
          const newStap = new StepDefinitionModel(data)
          await newStap.save()
          newStep.push(newStap._id)
          console.log(index, currentStepId)
          if (currentStepId) {
            const newSeq = index + 1
            await StepDefinitionModel.findByIdAndUpdate(currentStepId, { seq: newSeq })
            newStep.push(currentStepId)
            console.log(index, currentStepId)
          }
        } else if (index > data.seq) {
          if (currentStepId) {
            const newSeq = index + 1
            await StepDefinitionModel.findByIdAndUpdate(currentStepId, { seq: newSeq })
            newStep.push(currentStepId)
            console.log(index, currentStepId)
          }
        }
      })
      await ShipmentModel.findByIdAndUpdate(this._id, { steps: newStep })
      console.log('End Step: ')
      return true
    } catch (error) {
      throw error
    }
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
        updatedAt: new Date(),
      })
      const nextStepDeifinition = find(this.steps, ['seq', this.currentStepSeq + 1])
      const nextStepId = get(nextStepDeifinition, '_id', '')
      if (nextStepId) {
        const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)
        await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() })
        await ShipmentModel.findByIdAndUpdate(this._id, { currentStepSeq: nextStepDefinitionModel.seq })
        return true
      }
      return false
    } catch (error) {
      throw error
    }
  }

  async podSent(images: FileInput[], trackingNumber: string, provider: string): Promise<boolean> {
    try {
      const currentStep = find(this.steps, ['seq', this.currentStepSeq])
      const uploadedFiles = await Aigle.map(images, async (image) => {
        const fileModel = new FileModel(image)
        await fileModel.save()
        const file = await FileModel.findById(fileModel._id)
        return file
      })
      const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
      if (stepDefinitionModel.step === EStepDefinition.POD) {
        await stepDefinitionModel.updateOne({
          stepStatus: EStepStatus.DONE,
          images: uploadedFiles,
          updatedAt: new Date(),
        })
        const nextStep = find(this.steps, ['seq', this.currentStepSeq + 1])
        const nextStepId = get(nextStep, '_id', '')
        const shipmentModel = await ShipmentModel.findById(this._id)
        if (nextStepId) {
          const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)
          await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() })
          await shipmentModel.updateOne({
            currentStepSeq: nextStepDefinitionModel.seq,
            podDetail: Object.assign(shipmentModel.podDetail, { trackingNumber, provider }),
          })
        } else {
          await shipmentModel.updateOne({
            podDetail: Object.assign(shipmentModel.podDetail, { trackingNumber, provider }),
          })
        }
        return true
      } else {
        const message = 'ยังไม่ถึงขึ้นตอนการส่ง POD'
        throw new GraphQLError(message, {
          extensions: { code: REPONSE_NAME.SHIPMENT_NOT_FINISH, errors: [{ message }] },
        })
      }
    } catch (error) {
      throw error
    }
  }

  async finishJob(): Promise<boolean> {
    try {
      const currentStep = find(this.steps, ['seq', this.currentStepSeq])
      const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
      const currentDate = new Date()
      if (stepDefinitionModel.step === EStepDefinition.FINISH) {
        await stepDefinitionModel.updateOne({
          stepStatus: EStepStatus.DONE,
          customerMessage: 'ดำเนินการเสร็จสิ้น',
          driverMessage: 'ดำเนินการเสร็จสิ้น',
          updatedAt: currentDate,
        })
        await ShipmentModel.findByIdAndUpdate(this._id, {
          currentStepSeq: stepDefinitionModel.seq,
          status: EShipmentStatus.DELIVERED,
          deliveredDate: currentDate,
        })

        const pickup = head(this.destinations)
        const dropoffs = tail(this.destinations)
        const description = `${this.trackingNumber} ค่าขนส่งจาก ${pickup.name} ไปยัง ${reduce(
          dropoffs,
          (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
          '',
        )}`

        /**
         * TRANSACTIONS
         */
        const amountCost = get(this, 'payment.invoice.totalCost', 0)
        const amountPrice = get(this, 'payment.invoice.totalPrice', 0)
        const isAgentDriver = !isEmpty(this.agentDriver)
        const ownerDriverId = isAgentDriver ? get(this, 'agentDriver._id', '') : get(this, 'driver._id', '')

        const driver = await UserModel.findById(ownerDriverId)
        if (isAgentDriver && get(this, 'driver._id', '')) {
          /**
           * Update employee transaction
           */
          const employeeTransaction = new TransactionModel({
            amount: 0,
            ownerId: get(this, 'driver._id', ''),
            ownerType: ETransactionOwner.BUSINESS_DRIVER,
            description: `${this.trackingNumber} งานจาก ${driver.fullname}`,
            refId: this._id,
            refType: ERefType.SHIPMENT,
            transactionType: ETransactionType.INCOME,
            status: ETransactionStatus.COMPLETE,
          })
          await employeeTransaction.save()
        }
        /**
         * Add transaction for shipment driver owner
         */
        const driverTransaction = new TransactionModel({
          amount: amountCost,
          ownerId: ownerDriverId,
          ownerType: ETransactionOwner.DRIVER,
          description: description,
          refId: this._id,
          refType: ERefType.SHIPMENT,
          transactionType: ETransactionType.INCOME,
          status: ETransactionStatus.PENDING,
        })
        await driverTransaction.save()

        /**
         * Add transaction for Movemate Thailand
         */
        const movemateTransaction = new TransactionModel({
          amount: amountPrice,
          ownerId: MOVEMATE_OWNER_ID,
          ownerType: ETransactionOwner.MOVEMATE,
          description: description,
          refId: this._id,
          refType: ERefType.SHIPMENT,
          transactionType: ETransactionType.INCOME,
          status: ETransactionStatus.COMPLETE,
        })
        await movemateTransaction.save()

        // Update balance
        if (driver) {
          const driverDetail = await DriverDetailModel.findById(driver.driverDetail)
          await driverDetail.updateBalance()
        }

        /**
         * Notification
         */
        await NotificationModel.sendNotification({
          userId: this.customer as string,
          varient: ENotificationVarient.SUCCESS,
          title: 'งานขนส่งสำเร็จ',
          message: [
            `เราขอประกาศด้วยความยินดีว่าการขนส่งเลขที่ ${this.trackingNumber} ของท่านได้เสร็จสมบูรณ์!`,
            `สินค้าของท่านถูกนำส่งไปยังปลายทางเรียบร้อยแล้ว`,
          ],
          infoText: 'ดูสรุปการจองและค่าใช้จ่าย',
          infoLink: `/main/tracking?tracking_number=${this.trackingNumber}`,
        })

        return true
      } else {
        const message = 'ยังไม่ถึงขึ้นตอนการจบงาน'
        throw new GraphQLError(message, {
          extensions: { code: REPONSE_NAME.SHIPMENT_NOT_FINISH, errors: [{ message }] },
        })
      }
    } catch (error) {
      throw error
    }
  }

  static async markAsCashVerified(
    _id: string,
    result: 'approve' | 'reject',
    userId: string,
    reason?: string,
    otherReason?: string,
    refunId?: string,
  ) {
    const shipmentModel = await ShipmentModel.findById(_id)
    const shipment = await ShipmentModel.findById(_id).lean()
    if (!shipmentModel) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (result === 'approve') {
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      if (currentStep) {
        if (currentStep.step === EStepDefinition.CASH_VERIFY) {
          shipmentModel.nextStep()
        }
      }
      const _shipmentUpdateHistory = new UpdateHistoryModel({
        referenceId: _id,
        referenceType: 'Shipment',
        who: userId,
        beforeUpdate: shipment,
        afterUpdate: {
          ...shipment,
          status: EShipmentStatus.IDLE,
          adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
          driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
          steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }],
        },
      })
      await _shipmentUpdateHistory.save()
      await ShipmentModel.findByIdAndUpdate(_id, {
        status: EShipmentStatus.IDLE,
        adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
        driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
        $push: { history: _shipmentUpdateHistory },
      })

      /**
       * Sent notification
       */
      await NotificationModel.sendNotification({
        userId: shipment.customer as string,
        varient: ENotificationVarient.INFO,
        title: 'การจองของท่านยืนยันยอดชำระแล้ว',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองรถเลขที่ ${shipment.trackingNumber} ของท่านยืนยันยอดชำระแล้ว`,
          `การจองจะถูกดำเนินการจับคู่หาคนขับในไม่ช้า`,
        ],
        infoText: 'ดูการจอง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
      /**
       * Sent email ?
       */
    } else if (result === 'reject') {
      if (!reason) {
        const message = 'ไม่สามารถทำรายการได้ เนื่องจากไม่พบเหตุผลการไม่อนุมัติ'
        throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
      }
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      const lastStep = last(shipmentModel.steps) as StepDefinition
      if (currentStep) {
        const deniedSteps = filter(shipmentModel.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
        const steps = await Aigle.map(deniedSteps, async (step) => {
          const isCashVerifyStep = step.step === EStepDefinition.CASH_VERIFY && step.seq === currentStep.seq
          const cashVerifyStepChangeData = isCashVerifyStep
            ? {
                step: EStepDefinition.REJECTED_PAYMENT,
                stepName: EStepDefinitionName.REJECTED_PAYMENT,
                customerMessage: EStepDefinitionName.REJECTED_PAYMENT,
                driverMessage: EStepDefinitionName.REJECTED_PAYMENT,
              }
            : {}
          await StepDefinitionModel.findByIdAndUpdate(step._id, {
            stepStatus: EStepStatus.CANCELLED,
            ...cashVerifyStepChangeData,
          })
          return { ...step, stepStatus: EStepStatus.CANCELLED, ...cashVerifyStepChangeData }
        })
        // Add refund step
        const newLatestSeq = lastStep.seq + 1
        const refundStep = new StepDefinitionModel({
          step: EStepDefinition.REFUND,
          seq: newLatestSeq,
          stepName: EStepDefinitionName.REFUND,
          customerMessage: EStepDefinitionName.REFUND,
          driverMessage: EStepDefinitionName.REFUND,
          stepStatus: 'progressing',
        })
        await refundStep.save()
        // Update history
        const _shipmentUpdateHistory = new UpdateHistoryModel({
          referenceId: _id,
          referenceType: 'Shipment',
          who: userId,
          beforeUpdate: { ...shipment, steps: shipmentModel.steps },
          afterUpdate: {
            ...shipment,
            refund: refunId,
            status: EShipmentStatus.REFUND,
            adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
            steps: [...steps, refundStep],
          },
        })
        await _shipmentUpdateHistory.save()
        await ShipmentModel.findByIdAndUpdate(_id, {
          status: EShipmentStatus.REFUND,
          refund: refunId,
          adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
          currentStepSeq: newLatestSeq,
          $push: { history: _shipmentUpdateHistory, steps: refundStep._id },
        })

        /**
         * Sent notification
         */
        await NotificationModel.sendNotification({
          userId: shipment.customer as string,
          varient: ENotificationVarient.ERROR,
          title: 'การจองถูกยกเลิก',
          message: [
            `เราเสียใจที่ต้องแจ้งให้ท่านทราบว่าการจองเลขที่ ${shipment.trackingNumber} ของท่านถูกยกเลิกโดยทีมผู้ดูแลระบบของเรา`,
            `สาเหตุการยกเลิกคือ ${otherReason} และการจองจะถูกดำเนินการคืนเงินต่อไป`,
          ],
          infoText: 'ดูการจอง',
          infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
        })
        /**
         * Sent email
         */
      }
    }
  }

  static async markAsRefund(_id: string, userId: string) {
    const shipmentModel = await ShipmentModel.findById(_id)
    const shipment = await ShipmentModel.findById(_id).lean()
    if (!shipmentModel) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
    if (currentStep) {
      if (currentStep.step === EStepDefinition.REFUND) {
        await StepDefinitionModel.findByIdAndUpdate(currentStep._id, {
          stepStatus: EStepStatus.DONE,
          customerMessage: 'ดำเนินการคืนเงินแล้ว',
          driverMessage: 'ดำเนินการคืนเงินแล้ว',
        })
      }
    }

    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: _id,
      referenceType: 'Shipment',
      who: userId,
      beforeUpdate: shipment,
      afterUpdate: { ...shipment, steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }] },
    })
    await _shipmentUpdateHistory.save()
    await ShipmentModel.findByIdAndUpdate(_id, {
      status: EShipmentStatus.CANCELLED,
      $push: { history: _shipmentUpdateHistory },
    })
  }

  static async markAsNoRefund(_id: string, userId: string) {
    const shipmentModel = await ShipmentModel.findById(_id)
    const shipment = await ShipmentModel.findById(_id).lean()
    if (!shipmentModel) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
    if (currentStep) {
      if (currentStep.step === 'REFUND') {
        await StepDefinitionModel.findByIdAndUpdate(currentStep._id, { stepStatus: EStepStatus.CANCELLED })
      }
    }

    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: _id,
      referenceType: 'Shipment',
      who: userId,
      beforeUpdate: shipment,
      afterUpdate: { ...shipment, steps: [{ ...currentStep, stepStatus: EStepStatus.CANCELLED }] },
    })
    await _shipmentUpdateHistory.save()
    await ShipmentModel.findByIdAndUpdate(_id, {
      status: EShipmentStatus.CANCELLED,
      $push: { history: _shipmentUpdateHistory },
    })
  }

  static async getAcceptedShipmentForDriverQuery(status: EShipmentMatchingCriteria, userId: string) {
    const user = await UserModel.findById(userId)
    const isBusinessDriver = user.userType === EUserType.BUSINESS
    const driver = isBusinessDriver
      ? { agentDriver: new Types.ObjectId(userId) }
      : { driver: new Types.ObjectId(userId) }

    const statusQuery: FilterQuery<Shipment> =
      status === EShipmentMatchingCriteria.PROGRESSING // Status progressing
        ? {
            status: EShipmentMatchingCriteria.PROGRESSING,
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            ...driver,
          }
        : status === EShipmentMatchingCriteria.CANCELLED // Status cancelled
        ? {
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            ...driver,
            $or: [{ status: EShipmentMatchingCriteria.CANCELLED }, { status: 'refund' }],
          }
        : status === EShipmentMatchingCriteria.DELIVERED // Status complete
        ? {
            status: EShipmentMatchingCriteria.DELIVERED,
            driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
            ...driver,
          }
        : { _id: 'none' } // Not Included status

    return statusQuery
  }

  static async getNewAllAvailableShipmentForDriverQuery(driverId?: string) {
    let vehicleIds = null
    let employeeVehiclesIds = []
    let ignoreShipments = []
    if (driverId) {
      const user = await UserModel.findById(driverId).lean()
      if (user) {
        const isBusinessDriver = user.userType === EUserType.BUSINESS
        if (isBusinessDriver) {
          const childrens = await UserModel.find({
            parents: { $in: [driverId] },
            drivingStatus: { $in: [EDriverStatus.IDLE, EDriverStatus.WORKING] },
            status: EUserStatus.ACTIVE,
            validationStatus: EUserValidationStatus.APPROVE,
          })
          if (isEmpty(childrens)) {
            return []
          } else {
            const vehicles = reduce(
              childrens,
              (prev, curr) => {
                const vehicless = get(curr, 'driverDetail.serviceVehicleTypes', [])
                return [...prev, ...map(vehicless, (vehicle) => get(vehicle, '_id', ''))]
              },
              [],
            )
            employeeVehiclesIds = uniq(vehicles || [])
          }
        }
        if (user?.drivingStatus === EDriverStatus.BUSY) return []
        const driverDetail = await DriverDetailModel.findById(user.driverDetail).lean()
        if (driverDetail.serviceVehicleTypes) {
          vehicleIds = driverDetail.serviceVehicleTypes
          if (isBusinessDriver) {
            vehicleIds = union(vehicleIds || [], employeeVehiclesIds)
          }
        }
        const existingShipments = await ShipmentModel.find({
          ...(isBusinessDriver ? { agentDriver: user._id } : { driver: user._id }),
          status: EShipmentStatus.PROGRESSING,
          driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
        }).lean()
        ignoreShipments = isBusinessDriver
          ? []
          : map(existingShipments, (shipment) => {
              const start = shipment.bookingDateTime
              const end = addSeconds(shipment.bookingDateTime, shipment.displayTime)
              return { bookingDateTime: { $gte: start, $lt: end } }
            })
      }
    }

    const query = {
      status: EShipmentStatus.IDLE,
      driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
      ...(!isEmpty(vehicleIds) ? { vehicleId: { $in: vehicleIds } } : {}),
      $or: [
        { requestedDriver: { $exists: false } }, // ไม่มี requestedDriver
        { requestedDriver: null }, // requestedDriver เป็น null
        ...(driverId
          ? [
              { requestedDriver: new Types.ObjectId(driverId) }, // requestedDriver ตรงกับ userId
              { requestedDriver: { $ne: new Types.ObjectId(driverId) } }, // requestedDriver ไม่ตรงกับ userId
            ]
          : []),
      ],
      ...(driverId && !isEmpty(ignoreShipments) ? { $nor: ignoreShipments } : {}),
    }

    return query
  }

  static async getNewAllAvailableShipmentForDriver(driverId?: string, options: any = {}) {
    const generatedQuery = await this.getNewAllAvailableShipmentForDriverQuery(driverId)
    const queryOptions = Object.assign(options, { sort: { bookingDateTime: 1 } })
    const query = isEmpty(generatedQuery) ? {} : generatedQuery
    const shipments = await ShipmentModel.find(query, undefined, queryOptions).exec()
    if (!shipments) {
      return []
    }
    return shipments
  }

  static async calculateExistingShipment({
    shipmentId,
    isRounded,
    locations,
    vehicleTypeId,
    serviceIds,
  }: CalculationExistingArgs): Promise<SubtotalCalculatedPayload> {
    const shipment = await ShipmentModel.findById(shipmentId)
    if (!shipment) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const newVehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId)
    // .populate({ path: 'distance', options: { sort: { from: 1 } } })
    // .populate({
    //   path: 'additionalServices',
    //   match: { available: true },
    //   populate: {
    //     path: 'additionalService',
    //     model: 'AdditionalService',
    //   },
    // })
    // .lean()

    if (!newVehicleCost) {
      const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
      throw new GraphQLError(message, {
        extensions: { code: 'NOT_FOUND', errors: [{ message }] },
      })
    }

    // TODO: Check matching vehicle
    // const vehicleType = vehicleTypeId

    const original = head(locations)
    const destinationsRaw = tail(locations).map((destination) => destination.location)
    const destinations = isRounded ? [...destinationsRaw, original.location] : destinationsRaw
    const computeRoutes = await getRoute(original.location, destinations).catch((error) => {
      console.log(JSON.stringify(error, undefined, 2))
      throw error
    })
    const directionRoutes = head(computeRoutes.routes)
    const {
      displayDistance,
      displayTime,
      distance: distanceMeter,
      returnDistance: returnDistanceMeter,
    } = handleGetDistanceDetail(directionRoutes, shipment.vehicleId as VehicleType, isRounded)
    const distanceKM = distanceMeter / 1000
    const distanceReturnKM = returnDistanceMeter / 1000

    // Check again
    const originCalculation = calculateStep(
      distanceKM,
      sortBy(shipment.distances, ['form']) as ShipmentDistancePricing[],
    )
    const subTotalDistanceCost = originCalculation.cost
    const subTotalDistancePrice = originCalculation.price

    /**
     *
     * Get Droppoint codes
     */
    const dropPoint = locations.length - 1
    let subTotalDropPointCost = 0
    let subTotalDropPointPrice = 0
    if (dropPoint > 1) {
      const additionalExistingServiceDroppoint = find(
        shipment.additionalServices,
        (service: ShipmentAdditionalServicePrice) => {
          const coreService = get(service, 'reference.additionalService', undefined) as AdditionalService
          return coreService?.name === 'หลายจุดส่ง'
        },
      )

      if (additionalExistingServiceDroppoint) {
        const service = additionalExistingServiceDroppoint as ShipmentAdditionalServicePrice
        const droppointCost = service.cost || 0
        const droppointPrice = service.price || 0

        subTotalDropPointCost = dropPoint * droppointCost
        subTotalDropPointPrice = dropPoint * droppointPrice
      } else {
        const additionalServices = newVehicleCost.additionalServices as AdditionalServiceCostPricing[]
        const additionalServiceDroppoint = find(additionalServices, (service: AdditionalServiceCostPricing) => {
          const coreService = service.additionalService as AdditionalService
          return coreService.name === 'หลายจุดส่ง'
        })

        if (additionalServiceDroppoint) {
          const droppointCost = additionalServiceDroppoint.cost || 0
          const droppointPrice = additionalServiceDroppoint.price || 0

          subTotalDropPointCost = dropPoint * droppointCost
          subTotalDropPointPrice = dropPoint * droppointPrice
        }
      }
    }

    /**
     *
     * Get Rounded percent
     */
    let subTotalRoundedCost = 0
    let subTotalRoundedPrice = 0
    let roundedCostPercent = 0
    let roundedPricePercent = 0
    if (isRounded) {
      const additionalExistingServiceRouned = find(
        shipment.additionalServices,
        (service: AdditionalServiceCostPricing) => {
          const coreService = service.additionalService as AdditionalService
          return coreService?.name === 'ไป-กลับ'
        },
      )

      // Existing As percent
      if (additionalExistingServiceRouned) {
        const service = additionalExistingServiceRouned as ShipmentAdditionalServicePrice
        roundedCostPercent = service.cost || 0
        roundedPricePercent = service.price || 0
        const roundedCostPercentCal = (service.cost || 0) / 100
        const roundedPricePercentCal = (service.price || 0) / 100

        // Round calculation
        const roundedCalculation = calculateStep(distanceReturnKM, shipment.distances as ShipmentDistancePricing[])

        subTotalRoundedCost = roundedCostPercentCal * roundedCalculation.cost
        subTotalRoundedPrice = roundedPricePercentCal * roundedCalculation.price
      } else {
        const additionalServices = newVehicleCost.additionalServices as AdditionalServiceCostPricing[]
        const additionalServiceRouned = find(additionalServices, (service: AdditionalServiceCostPricing) => {
          const coreService = service.additionalService as AdditionalService
          return coreService?.name === 'ไป-กลับ'
        })

        // Existing As percent
        if (additionalServiceRouned) {
          roundedCostPercent = additionalServiceRouned.cost || 0
          roundedPricePercent = additionalServiceRouned.price || 0
          const roundedCostPercentCal = (additionalServiceRouned.cost || 0) / 100
          const roundedPricePercentCal = (additionalServiceRouned.price || 0) / 100

          // Round calculation
          const roundedCalculation = calculateStep(distanceReturnKM, shipment.distances as ShipmentDistancePricing[])

          subTotalRoundedCost = roundedCostPercentCal * roundedCalculation.cost
          subTotalRoundedPrice = roundedPricePercentCal * roundedCalculation.price
        }
      }
    }

    /**
     *
     * Total Distance price
     */
    const totalDistanceCost = sum([subTotalDropPointCost, subTotalDistanceCost, subTotalRoundedCost])
    const totalDistancePrice = sum([subTotalDropPointPrice, subTotalDistancePrice, subTotalRoundedPrice])

    /**
     * Additional Service Cost Pricng
     */
    const additionalServicesPricing = await Aigle.map<string, PriceItem>(serviceIds, async (serviceId) => {
      const service = find(shipment.additionalServices, ['reference._id', serviceId]) as
        | ShipmentAdditionalServicePrice
        | undefined
      if (service) {
        const label = get(service, 'reference.additionalService.name', '')
        return {
          label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
          cost: service.cost,
          price: service.price,
          isNew: false,
        }
      } else {
        const newService = await AdditionalServiceCostPricingModel.findById(serviceId)
        if (newService) {
          const label = get(newService.additionalService, 'name', '')
          return {
            label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
            cost: newService.cost,
            price: newService.price,
            isNew: true,
          }
        } else {
          return {
            label: '',
            cost: 0,
            price: 0,
            isNew: false,
          }
        }
      }
    })

    const servicesTotalPrice = reduce(
      additionalServicesPricing,
      (prev, curr) => {
        const cost = sum([prev.cost, curr.cost])
        const price = sum([prev.price, curr.price])
        return { cost, price }
      },
      { cost: 0, price: 0 },
    )

    /**
     *
     * Privilege
     */
    // Privilege
    // let discountName = ''
    // let totalDiscount = 0
    // if (discountId) {
    //   const privilege = await PrivilegeModel.findById(discountId)
    //   if (privilege) {
    //     const { unit, discount, minPrice, maxDiscountPrice } = privilege
    //     const subTotal = sum([calculated.totalPrice, additionalservices.price])
    //     const isPercent = unit === EPrivilegeDiscountUnit.PERCENTAGE
    //     if (subTotal >= minPrice) {
    //       if (isPercent) {
    //         const discountAsBath = (discount / 100) * subTotal
    //         const maxDiscountAsBath = maxDiscountPrice ? min([maxDiscountPrice, discountAsBath]) : discountAsBath
    //         totalDiscount = maxDiscountAsBath
    //       } else {
    //         totalDiscount = discount
    //       }
    //     } else {
    //       totalDiscount = 0
    //     }
    //     discountName = `${privilege.name} (${privilege.discount}${
    //       privilege.unit === EPrivilegeDiscountUnit.CURRENCY
    //         ? ' บาท'
    //         : privilege.unit === EPrivilegeDiscountUnit.PERCENTAGE
    //         ? '%'
    //         : ''
    //     })`
    //   }
    // }

    const subTotalCost = sum([totalDistanceCost, servicesTotalPrice.cost])
    const subTotalPrice = sum([totalDistancePrice, servicesTotalPrice.price])

    /**
     * งานเงินสด
     * บริษัท
     * - แสดงและคำนวณ WHT ทุกครั้ง และแสดงทุกครั้ง
     * (ค่าขนส่งเกิน 1000 คิด WHT 1%)
     * (ค่าขนส่งน้อยกว่า 1000 คิดราคาเต็ม)
     */
    const customerTypes = get(shipment, 'customer.userType', '')
    let whtName = ''
    let wht = 0
    const isTaxCalculation = customerTypes === EUserType.BUSINESS && subTotalPrice > 1000
    if (isTaxCalculation) {
      whtName = 'ค่าภาษีบริการขนส่งสินค้าจากบริษัท 1% (WHT)'
      wht = subTotalPrice * 0.01
    }

    const vehicleName = get(shipment, 'vehicleId.name', '')
    const distanceKMText = fNumber(distanceKM, '0.0')
    const distanceReturnKMText = fNumber(distanceReturnKM, '0.0')

    const totalCost = sum([subTotalCost])
    const totalPrice = sum([subTotalPrice, -wht])

    const formula: PricingCalculationMethodPayload = {
      calculations: originCalculation.calculations,
      roundedCostPercent,
      roundedPricePercent,
      subTotalRoundedCost,
      subTotalRoundedPrice,
      subTotalCost,
      subTotalPrice,
      subTotalDropPointCost,
      subTotalDropPointPrice,
      totalCost,
      totalPrice,
    }

    return {
      shippingPrices: [
        {
          label: `${vehicleName} (${fNumber(distanceKMText)} กม.)`,
          price: subTotalDistancePrice,
          cost: subTotalDistanceCost,
        },
        ...(isRounded
          ? [
              {
                label: `ไป-กลับ ${roundedPricePercent}% (${distanceReturnKMText} กม.)`,
                price: subTotalRoundedPrice,
                cost: subTotalRoundedCost,
              },
            ]
          : []),
      ],
      additionalServices: [
        ...(dropPoint > 1
          ? [
              {
                label: 'หลายจุดส่ง',
                price: subTotalDropPointPrice,
                cost: subTotalDropPointCost,
              },
            ]
          : []),
        ...additionalServicesPricing,
      ],
      discounts: [], // discountId ? [{ label: discountName, price: totalDiscount, cost: 0 }] : [],
      taxs: isTaxCalculation ? [{ label: whtName, price: wht, cost: 0 }] : [],
      subTotalCost: subTotalCost,
      subTotalPrice: subTotalPrice,
      totalCost: totalCost,
      totalPrice: totalPrice,
      formula,
      displayDistance,
      displayTime,
      distance: distanceMeter,
    }
  }

  async updateShipment(data: CalculationExistingArgs) {
    const { isRounded, locations, vehicleTypeId, serviceIds } = data
    const { formula, displayDistance, displayTime, distance, ...invoice } = await Shipment.calculateExistingShipment(
      data,
    )

    // Duplicate additional service cost for invoice data
    const oldServices = filter(this.additionalServices as ShipmentAdditionalServicePrice[], (service) => {
      const _id = get(service, 'reference._id', '')
      return !isEmpty(_id)
    }).map((service) => service._id.toString())
    const serviceBulkOperations = await Aigle.map<string, AnyBulkWriteOperation>(serviceIds, async (serviceCostId) => {
      const serviceCost = await AdditionalServiceCostPricingModel.findById(serviceCostId).lean()
      return {
        insertOne: {
          document: {
            cost: serviceCost.cost,
            price: serviceCost.price,
            reference: serviceCost._id,
          },
        },
      }
    })

    const serviceBulkResult = await ShipmentAdditionalServicePriceModel.bulkWrite(serviceBulkOperations)
    const _additionalServices = values(serviceBulkResult.insertedIds)

    const destinations = await Aigle.map<DestinationInput, Destination>(locations, async (location) => {
      const { place } = await getPlaceDetail(location.placeId)
      const { province, district, subDistrict } = extractThaiAddress(place.addressComponents || [])
      return {
        ...location,
        placeDetail: place,
        placeProvince: province,
        placeDistrict: district,
        placeSubDistrict: subDistrict,
      }
    })

    const oldPayment = this.payment as Payment
    const isCreditPayment = oldPayment.paymentMethod === EPaymentMethod.CREDIT
    const _paymentNumber = await generateTrackingNumber(isCreditPayment ? 'MMPAYCE' : 'MMPAYCA', 'payment')

    const payment = new PaymentModel({
      paymentNumber: _paymentNumber,
      status: isCreditPayment ? EPaymentStatus.INVOICE : EPaymentStatus.WAITING_CONFIRM_PAYMENT,
      paymentMethod: oldPayment.paymentMethod,
      creditDetail: oldPayment.creditDetail,
      calculation: formula,
      invoice,
    })

    await payment.save()
    await ShipmentModel.findByIdAndUpdate(this._id, {
      displayDistance,
      displayTime,
      distance,
      destinations,
      isRoundedReturn: isRounded,
      vehicleId: vehicleTypeId,
      additionalServices: [...oldServices, ..._additionalServices],
      payment,
      paymentOlds: { $push: this.payment },
    })

    // Noti
  }
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel

// Get distance
function handleGetDistanceDetail(route: google.maps.DirectionsRoute, vehicle: VehicleType, isRounded: boolean) {
  const legs = route?.legs
  const timeAnDistance = reduce(
    legs,
    (prev, curr) => {
      const distance = prev.distance + get(curr, 'distance.value', 0)
      const duration = prev.duration + get(curr, 'duration.value', 0)
      return { distance, duration }
    },
    { distance: 0, duration: 0 },
  )
  const originDistance = isRounded ? get(legs, '0.distance.value', 0) : timeAnDistance.distance
  const returnDistance = isRounded ? get(legs, '1.distance.value', 0) : 0

  const w4 = [1800, 2700] // 30s - 45s
  const other = [2700, 3600] // 45s - 60s

  // Make random time
  // const vehicleCost = find(vehicleCosts, ['vehicleType._id', vehicleId])
  const typeVehicle = vehicle.type
  const distanceTime = typeVehicle ? (typeVehicle === '4W' ? random(w4[0], w4[1]) : random(other[0], other[1])) : 0

  return {
    displayDistance: timeAnDistance.distance,
    displayTime: sum([timeAnDistance.duration, distanceTime]),
    distance: originDistance,
    returnDistance: returnDistance,
  }
}

function calculateStep(distanceInput: number, formulas: ShipmentDistancePricing[]) {
  let _subTotalCost = 0
  let _subTotalPrice = 0
  const _calculations: CalculationResultPayload[] = []

  // Calculate for each distance
  forEach(formulas, (step: ShipmentDistancePricing, index) => {
    if (distanceInput >= step.from) {
      const stepTo = step.to === step.from ? Infinity : step.to
      const applicableDistance = Math.min(distanceInput, stepTo ?? distanceInput) - step.from + 1
      const calculatedCost = step.unit === EDistanceCostPricingUnit.KM ? step.cost * applicableDistance : step.cost
      const calculatedPrice = step.unit === EDistanceCostPricingUnit.KM ? step.price * applicableDistance : step.price

      _subTotalCost += calculatedCost
      _subTotalPrice += calculatedPrice

      _calculations.push({
        ...(step as DistanceCostPricing),
        costResult: calculatedCost,
        priceResult: calculatedPrice,
      })
    }
  })

  return {
    calculations: _calculations,
    cost: _subTotalCost,
    price: _subTotalPrice,
  }
}
