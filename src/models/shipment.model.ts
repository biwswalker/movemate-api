import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, Severity, plugin } from '@typegoose/typegoose'
import UserModel, { User } from './user.model'
import { IsEnum } from 'class-validator'
import PrivilegeModel, { Privilege } from './privilege.model'
import { VehicleType } from './vehicleType.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose, { Schema, Types } from 'mongoose'
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
import lodash, {
  filter,
  find,
  flatten,
  get,
  head,
  isEmpty,
  isEqual,
  last,
  map,
  min,
  range,
  reduce,
  sum,
  tail,
  values,
} from 'lodash'
import { fNumber } from '@utils/formatNumber'
import AdditionalServiceCostPricingModel from './additionalServiceCostPricing.model'
import { SubtotalCalculatedPayload } from '@payloads/booking.payloads'
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
import { EPaymentMethod } from '@enums/payments'
import {
  EShipmentStatus,
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentCancellationReason,
} from '@enums/shipments'
import { addSeconds } from 'date-fns'
import { EDriverStatus, EUserType } from '@enums/users'

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
          discountName = `${privilege.name} (${privilege.discount}${
            privilege.unit === 'currency' ? ' บาท' : privilege.unit === 'percentage' ? '%' : ''
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
        if (nextStepId) {
          const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)
          await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() })
          const shipmentModel = await ShipmentModel.findById(this._id)
          await shipmentModel.updateOne({
            currentStepSeq: nextStepDefinitionModel.seq,
            podDetail: {
              ...shipmentModel.podDetail,
              trackingNumber,
              provider,
            },
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
        const description = `ค่าขนส่งจาก ${pickup.name} ไปยัง ${reduce(
          dropoffs,
          (prev, curr) => (prev ? curr.name : `${prev}, ${curr.name}`),
          '',
        )}`

        /**
         * TRANSACTIONS
         */
        const amountCost = get(this, 'payment.invoice.totalCost', 0)
        const amountPrice = get(this, 'payment.invoice.totalPrice', 0)
        const driverId = get(this, 'driver._id', '')
        // For Driver transaction
        const driverTransaction = new TransactionModel({
          amount: amountCost,
          ownerId: driverId,
          ownerType: ETransactionOwner.DRIVER,
          description: description,
          refId: this._id,
          refType: ERefType.SHIPMENT,
          transactionType: ETransactionType.INCOME,
          status: ETransactionStatus.PENDING,
        })
        await driverTransaction.save()
        // For Movemate transaction
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
        const driver = await UserModel.findById(driverId).lean()
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

  static async getNewAllAvailableShipmentForDriver(driverId?: string) {
    let vehicleIds = null
    let ignoreShipments = []
    if (driverId) {
      const user = await UserModel.findById(driverId).lean()
      if (user) {
        const isBusinessDriver = user.userType === EUserType.BUSINESS
        if (isBusinessDriver) {
          const childrens = await UserModel.find({ parents: { $in: [driverId] } }).lean()
          if (isEmpty(childrens)) {
            return []
          }
        }
        if (user?.drivingStatus === EDriverStatus.BUSY) return []
        const driverDetail = await DriverDetailModel.findById(user.driverDetail).lean()
        if (driverDetail.serviceVehicleTypes) {
          vehicleIds = driverDetail.serviceVehicleTypes
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

    const shipments = await ShipmentModel.find(query).sort({ bookingDateTime: 1 }).exec()
    if (!shipments) {
      return []
    }
    return shipments
  }
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel
