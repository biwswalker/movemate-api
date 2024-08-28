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
import lodash, { filter, find, flatten, get, isEqual, last, map, min, range, sum, values } from 'lodash'
import { fNumber } from '@utils/formatNumber'
import AdditionalServiceCostPricingModel from './additionalServiceCostPricing.model'
import { SubtotalCalculatedPayload } from '@payloads/booking.payloads'
import StepDefinitionModel, { EStepDefinition, EStepDefinitionName, EStepStatus, StepDefinition } from './shipmentStepDefinition.model'
import { FileInput } from '@inputs/file.input'
import Aigle from 'aigle'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import { Refund } from './refund.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import NotificationModel from './notification.model'

Aigle.mixin(lodash, {});

export enum EShipingStatus {
  IDLE = 'idle',
  PROGRESSING = 'progressing',
  DELIVERED = 'dilivered',
  CANCELLED = 'cancelled',
  REFUND = 'refund',
}

export enum EAdminAcceptanceStatus {
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

export enum EShipmentCancellationReason {
  LOST_ITEM = 'lost_item',
  INCOMPLETE_INFO = 'incomplete_info',
  RECIPIENT_UNAVAILABLE = 'recipient_unavailable',
  BOOKING_ISSUE = 'booking_issue',
  VEHICLE_ISSUE = 'vehicle_issue',
  DRIVER_CANCELLED = 'driver_cancelled',
  DELAYED_SHIPMENT = 'delayed_shipment',
  CUSTOMER_REQUEST = 'customer_request',
  PACKING_ERROR = 'packing_error',
  MANAGEMENT_DECISION = 'management_decision',
  OTHER = 'other'
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
  history: Ref<UpdateHistory>[];

  @Field(() => String, { nullable: true })
  @IsEnum(EShipmentCancellationReason)
  @Property({ enum: EShipmentCancellationReason, required: false })
  cancellationReason: TShipmentCancellationReason

  @Field(() => String, { nullable: true })
  @Property({ required: false })
  cancellationDetail: string

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  deliveredDate?: Date

  static paginate: mongoose.PaginateModel<typeof Shipment>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof Shipment>['aggregatePaginate']

  static async calculate({ vehicleTypeId, distanceMeter, distanceReturnMeter, dropPoint, isRounded, discountId, serviceIds, isBusinessCashPayment }: SubtotalCalculationArgs, costCalculation: boolean = false): Promise<SubtotalCalculatedPayload> {
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
          discountName = `${privilege.name} (${privilege.discount}${privilege.unit === 'currency' ? ' บาท' : privilege.unit === 'percentage' ? '%' : ''})`
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
        wht = subTotalPrice * (0.01)
      }


      const totalCost = sum([subTotalCost])
      const totalPrice = sum([subTotalPrice, -wht])
      return {
        shippingPrices: [
          { label: `${vehicleName} (${fNumber(distanceKM)} กม.)`, price: calculated.subTotalPrice, cost: costCalculation ? calculated.subTotalCost : 0 },
          ...(isRounded ? [{ label: `ไป-กลับ ${calculated.roundedPricePercent}% (${distanceReturnKM} กม.)`, price: calculated.subTotalRoundedPrice, cost: costCalculation ? calculated.subTotalRoundedCost : 0 }] : []),
        ],
        additionalServices: [
          ...(dropPoint > 1 ? [{ label: 'หลายจุดส่ง', price: calculated.subTotalDropPointPrice, cost: costCalculation ? calculated.subTotalDropPointCost : 0 }] : []),
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

  static async markAsCashVerified(_id: string, result: 'approve' | 'reject', userId: string, reason?: string, otherReason?: string) {
    const shipmentModel = await ShipmentModel.findById(_id)
    const shipment = await ShipmentModel.findById(_id).lean()
    if (!shipmentModel) {
      const message = "ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว";
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    if (result === 'approve') {
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      if (currentStep) {
        if (currentStep.step === 'CASH_VERIFY') {
          shipmentModel.nextStep()
        }
      }
      const _shipmentUpdateHistory = new UpdateHistoryModel({
        referenceId: _id,
        referenceType: "Shipment",
        who: userId,
        beforeUpdate: shipment,
        afterUpdate: { ...shipment, status: EShipingStatus.IDLE, adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED, steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }] },
      });
      await _shipmentUpdateHistory.save()
      await ShipmentModel.findByIdAndUpdate(_id, {
        status: EShipingStatus.IDLE,
        adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
        $push: { history: _shipmentUpdateHistory }
      })

      /**
       * Sent notification
       */
      await NotificationModel.sendNotification({
        userId: shipment.customer as string,
        varient: 'info',
        title: 'การจองของท่านยืนยันยอดชำระแล้ว',
        message: [`เราขอแจ้งให้ท่าทราบว่าการจองรถเลขที่ ${shipment.trackingNumber} ของท่านยืนยันยอดชำระแล้ว`, `การจองจะถูกดำเนินการจับคู่หาคนขับในไม่ช้า`],
        infoText: 'ดูการจอง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
      /**
       * Sent email ?
       */
    } else if (result === 'reject') {
      if (!reason) {
        const message = "ไม่สามารถทำรายการได้ เนื่องจากไม่พบเหตุผลการไม่อนุมัติ";
        throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
      }
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      const lastStep = last(shipmentModel.steps) as StepDefinition
      if (currentStep) {
        const deniedSteps = filter(shipmentModel.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
        const steps = await Aigle.map(deniedSteps, async (step) => {
          const isCashVerifyStep = step.step === EStepDefinition.CASH_VERIFY && step.seq === currentStep.seq
          const cashVerifyStepChangeData = isCashVerifyStep ? {
            step: EStepDefinition.REJECTED_PAYMENT,
            stepName: EStepDefinitionName.REJECTED_PAYMENT,
            customerMessage: EStepDefinitionName.REJECTED_PAYMENT,
            driverMessage: EStepDefinitionName.REJECTED_PAYMENT,
          } : {}
          await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED, ...cashVerifyStepChangeData })
          return { ...step, stepStatus: EStepStatus.CANCELLED, ...cashVerifyStepChangeData }
        })
        // Add refund step
        const newLatestSeq = lastStep.seq + 1
        const refundStep = new StepDefinitionModel({
          step: 'REFUND',
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
          referenceType: "Shipment",
          who: userId,
          beforeUpdate: { ...shipment, steps: shipmentModel.steps },
          afterUpdate: { ...shipment, status: EShipingStatus.REFUND, adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED, steps: [...steps, refundStep] },
        });
        await _shipmentUpdateHistory.save()
        await ShipmentModel.findByIdAndUpdate(_id, {
          status: EShipingStatus.REFUND,
          adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
          currentStepSeq: newLatestSeq,
          $push: { history: _shipmentUpdateHistory, steps: refundStep._id }
        })

        /**
         * Sent notification
         */
        await NotificationModel.sendNotification({
          userId: shipment.customer as string,
          varient: 'error',
          title: 'การจองถูกยกเลิก',
          message: [`เราเสียใจที่ต้องแจ้งให้ท่านทราบว่าการจองเลขที่ ${shipment.trackingNumber} ของท่านถูกยกเลิกโดยทีมผู้ดูแลระบบของเรา`, `สาเหตุการยกเลิกคือ ${otherReason} และการจองจะถูกดำเนินการคืนเงินต่อไป`],
          infoText: 'ดูการจอง',
          infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
        })
        /**
         * Sent email
         */
      }
    }
  }

  static async markAsRefund(_id: string, userId: string, refund: Refund) {
    const shipmentModel = await ShipmentModel.findById(_id)
    const shipment = await ShipmentModel.findById(_id).lean()
    if (!shipmentModel) {
      const message = "ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว";
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
    if (currentStep) {
      if (currentStep.step === 'REFUND') {
        await StepDefinitionModel.findByIdAndUpdate(currentStep._id, { stepStatus: EStepStatus.DONE })
      }
    }

    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: _id,
      referenceType: "Shipment",
      who: userId,
      beforeUpdate: shipment,
      afterUpdate: { ...shipment, steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }], refund },
    });
    await _shipmentUpdateHistory.save()
    await ShipmentModel.findByIdAndUpdate(_id, { refund, $push: { history: _shipmentUpdateHistory } })
  }

  async markAsDone() {
    console.log('markAsDone: ', this.status)
  }
}

const ShipmentModel = getModelForClass(Shipment)

export default ShipmentModel