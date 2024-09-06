import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import UserModel, { EUserRole, EUserStatus, EUserType, User } from './user.model'
import ShipmentModel, { EShipingStatus, Shipment } from './shipment.model'
import BillingPaymentModel, { BillingPayment, EBillingPaymentStatus } from './billingPayment.model'
import { BusinessCustomer } from './customerBusiness.model'
import BusinessCustomerCreditPaymentModel, { BusinessCustomerCreditPayment } from './customerBusinessCreditPayment.model'
import lodash, { get, isEmpty, reduce, sum, toNumber, toString, slice, forEach, head, tail, uniq, includes } from 'lodash'
import { addDays, addMonths, differenceInDays, format } from 'date-fns'
import { EPaymentMethod, EPaymentRejectionReason, Payment } from './payment.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GET_CUSTOMER_WITH_TODAY_BILLED_DATE } from '@pipelines/user.pipeline'
import { email_sender } from '@utils/email.utils'
import { th } from 'date-fns/locale'
import PDFDocument from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { VehicleType } from './vehicleType.model'
import { fDate } from '@utils/formatTime'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import ThaiBahtText from 'thai-baht-text'
import { AggregatePaginateModel } from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import PaymentModel, { EPaymentStatus } from './payment.model'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import { IsEnum } from 'class-validator'
import RefundModel, { Refund } from './refund.model'
import NotificationModel, { ENotificationVarient } from './notification.model'
import { IndividualCustomer } from './customerIndividual.model'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { getAdminMenuNotificationCount } from '@resolvers/notification.resolvers'

Aigle.mixin(lodash, {})

export enum EBillingStatus {
  VERIFY = 'verify',
  CURRENT = 'current',
  OVERDUE = 'overdue',
  PAID = 'paid',
  REFUND = 'refund',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

interface MarkAsPaidPaymentProps {
  billingCycleId: string
  paymentNumber: string
  paymentAmount: number
  paymentDate: Date
  imageEvidenceId?: string
  bank?: string
  bankName?: string
  bankNumber?: string
}

interface MarkAsRefundProps {
  billingCycleId: string
  imageEvidenceId: string
  paymentDate: Date
  paymentTime: Date
}

@ObjectType()
export class PostalInvoice {
  @Field()
  @Property({ required: true })
  trackingNumber: string

  @Field()
  @Property({ required: true })
  postalProvider: string

  @Field()
  @Property({ required: true })
  createdDateTime: Date

  @Field()
  @Property({ required: true })
  updatedBy: string
}

@plugin(mongooseAutoPopulate)
@plugin(mongooseAggregatePaginate)
@ObjectType()
export class BillingCycle extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ ref: () => User, required: true, autopopulate: true })
  user: Ref<User>

  @Field()
  @Property({ required: true })
  billingNumber: string

  @Field()
  @Property({ required: true })
  issueDate: Date

  @Field()
  @Property({ required: true })
  billingStartDate: Date

  @Field()
  @Property({ required: true })
  billingEndDate: Date

  @Field()
  @Property({ enum: EBillingStatus, required: true, default: EBillingStatus.CURRENT })
  billingStatus: EBillingStatus

  @Field()
  @Property({ enum: EPaymentMethod, required: true })
  paymentMethod: EPaymentMethod

  @Field(() => BillingPayment, { nullable: true })
  @Property({ ref: () => BillingPayment, autopopulate: true })
  billingPayment?: Ref<BillingPayment>

  @Field(() => [Shipment])
  @Property({ ref: () => Shipment, required: true, default: [], autopopulate: true })
  shipments: Ref<Shipment>[]

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  subTotalAmount: number

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  taxAmount: number

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  totalAmount: number

  @Field({ nullable: true })
  @Property()
  paymentDueDate?: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field({ nullable: true })
  @Property({ required: false })
  emailSendedTime: Date

  @Field({ nullable: true })
  @Property({ required: false })
  postalInvoice: PostalInvoice

  @Field(() => String, { nullable: true })
  @IsEnum(EPaymentRejectionReason)
  @Property({ enum: EPaymentRejectionReason, required: false })
  rejectedReason: EPaymentRejectionReason

  @Field(() => String, { nullable: true })
  @Property({ required: false })
  rejectedDetail: string

  @Field(() => String, { nullable: true })
  @Property({ required: false })
  cancelledDetail: string

  @Field(() => Refund, { nullable: true })
  @Property({ ref: () => Refund, required: false, autopopulate: true })
  refund?: Ref<Refund>

  @Field(() => [UpdateHistory], { nullable: true })
  @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
  history: Ref<UpdateHistory>[]

  @Field({ nullable: true })
  @Property({ required: false })
  issueInvoiceFilename: string

  static aggregatePaginate: AggregatePaginateModel<typeof BillingCycle>['aggregatePaginate']

  static async createBillingCycleForUser(userId: string) {
    const customer = await UserModel.findById(userId)
    if (customer && customer.userType === EUserType.BUSINESS && customer.userRole === EUserRole.CUSTOMER) {
      const businessDetail = customer.businessDetail as BusinessCustomer | undefined
      if (businessDetail) {
        const creditPayment = businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
        if (creditPayment) {
          const billingDate = get(creditPayment, `billedDate.${format(new Date(), 'MMM').toLowerCase()}`, 1)
          const duedateDate = get(creditPayment, `billedRound.${format(new Date(), 'MMM').toLowerCase()}`, 15)

          // change back
          const billedDate = new Date().setDate(billingDate)
          const shipmentStartDeliveredDate = addMonths(billedDate, -1).setHours(0, 0, 0, 0)
          const shipmentEndDeliveredDate = addDays(billedDate, -1).setHours(23, 59, 59, 999)

          const shipments = await ShipmentModel.find({
            customer: userId,
            status: EShipingStatus.DELIVERED,
            deliveredDate: { $gte: shipmentStartDeliveredDate, $lte: shipmentEndDeliveredDate },
          }).populate({ path: 'payment', match: { paymentMethod: EPaymentMethod.CREDIT } })

          const subTotalAmount = reduce(
            shipments,
            (prev, shipment) => {
              if (shipment.payment) {
                const payment = shipment.payment as Payment
                const payTotal = payment.calculation.totalPrice
                return prev + payTotal
              }
              return prev + 0
            },
            0,
          )

          // Remark: WHT calculate, when > 1000
          let taxAmount = 0
          if (subTotalAmount > 1000) {
            const wht = 1 / 100
            taxAmount = wht * subTotalAmount
          }

          const totalAmount = sum([subTotalAmount, -taxAmount])

          const paymentDueDate = new Date(new Date().setDate(duedateDate)).setHours(23, 59, 59, 999)

          const _month = format(new Date(), 'MM')
          const _year = toNumber(format(new Date(), 'yyyy')) + 543
          const _billingNumber = await generateTrackingNumber(`IV${_month}${_year}`, 'invoice')
          const billingCycle = new BillingCycleModel({
            user: userId,
            billingNumber: _billingNumber,
            issueDate: billedDate,
            billingStartDate: shipmentStartDeliveredDate,
            billingEndDate: shipmentEndDeliveredDate,
            shipments,
            subTotalAmount,
            taxAmount,
            totalAmount,
            paymentDueDate,
            paymentMethod: EPaymentMethod.CREDIT,
          })

          await billingCycle.save()
        }
      }
    }
  }

  static async processPayment({
    billingCycleId,
    paymentNumber,
    paymentAmount,
    imageEvidenceId,
    bank,
    bankName,
    bankNumber,
  }: MarkAsPaidPaymentProps) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId)
    if (billingCycle) {
      const payment = new BillingPaymentModel({
        paymentNumber,
        paymentAmount,
        paymentDate: new Date(),
        status: EBillingPaymentStatus.PENDING,
        ...(imageEvidenceId ? { imageEvidence: imageEvidenceId } : {}),
        ...(bank ? { bank } : {}),
        ...(bankName ? { bankName } : {}),
        ...(bankNumber ? { bankNumber } : {}),
      })
      await payment.save()

      await billingCycle.updateOne({
        billingPayment: payment,
        billingStatus: EBillingStatus.VERIFY,
      })
    }
  }

  static async markAsPaid(billingCycleId: string, userId: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      await BillingPaymentModel.findByIdAndUpdate(billingCycle.billingPayment, { status: EBillingPaymentStatus.PAID })
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: { ...billingCycle, billingStatus: EBillingStatus.PAID },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, {
        billingStatus: EBillingStatus.PAID,
        $push: { history: _billingCycleUpdateHistory },
      })
      // Update shipment
      const shipments = billingCycle.shipments
      await Aigle.forEach(shipments as Shipment[], async (shipment) => {
        const shipmentModel = await ShipmentModel.findById(shipment)
        const payment = await PaymentModel.findById(shipmentModel.payment).lean()

        // Update Payment model
        const _paymentUpdateHistory = new UpdateHistoryModel({
          referenceId: payment._id,
          referenceType: 'Payment',
          who: userId,
          beforeUpdate: payment,
          afterUpdate: { ...payment, status: EPaymentStatus.PAID },
        })
        await _paymentUpdateHistory.save()
        await PaymentModel.findByIdAndUpdate(payment._id, {
          status: EPaymentStatus.PAID,
          $push: { history: _paymentUpdateHistory },
        })

        // Update Shipment model
        await ShipmentModel.markAsCashVerified(shipment._id, 'approve', userId)
      })

      // Trigger admin notification
      await getAdminMenuNotificationCount()

      // TODO: Recheck again
      // const customerId = get(billingCycle, 'user._id', '')
      // if (customerId) {
      //   await UserModel.findByIdAndUpdate(customerId, { static: EUserStatus.ACTIVE })
      // }
    }
  }

  static async rejectedPayment(billingCycleId: string, userId: string, reason?: string, otherReason?: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      await BillingPaymentModel.findByIdAndUpdate(billingCycle.billingPayment, { status: EBillingPaymentStatus.FAILED })
      // Update Biling cycle model
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: {
          ...billingCycle,
          billingStatus: EBillingStatus.REFUND,
          rejectedReason: reason,
          rejectedDetail: otherReason,
        },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(billingCycle._id, {
        billingStatus: EBillingStatus.REFUND,
        rejectedReason: reason,
        rejectedDetail: otherReason,
        $push: { history: _billingCycleUpdateHistory },
      })
      // Update shipment
      const shipments = billingCycle.shipments
      await Aigle.forEach(shipments as Shipment[], async (shipment) => {
        const shipmentModel = await ShipmentModel.findById(shipment)
        const payment = await PaymentModel.findById(shipmentModel.payment).lean()

        // Update Payment model
        const _paymentUpdateHistory = new UpdateHistoryModel({
          referenceId: payment._id,
          referenceType: 'Payment',
          who: userId,
          beforeUpdate: payment,
          afterUpdate: {
            ...payment,
            status: EPaymentStatus.REFUND,
            rejectionReason: reason,
            rejectionOtherReason: otherReason || '',
          },
        })
        await _paymentUpdateHistory.save()
        await PaymentModel.findByIdAndUpdate(payment._id, {
          status: EPaymentStatus.REFUND,
          rejectionReason: reason,
          rejectionOtherReason: otherReason || '',
          $push: { history: _paymentUpdateHistory },
        })

        // Update Shipment model
        await ShipmentModel.markAsCashVerified(shipment._id, 'reject', userId, reason, otherReason)
      })

      // Trigger admin notification
      await getAdminMenuNotificationCount()
    }
  }

  static async markAsRefund(data: MarkAsRefundProps, userId: string) {
    const billingCycle = await BillingCycleModel.findById(data.billingCycleId).lean()
    if (billingCycle) {
      const _refund = new RefundModel({
        imageEvidence: data.imageEvidenceId,
        paymentDate: data.paymentDate,
        paymentTime: data.paymentTime,
      })
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: data.billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: { ...billingCycle, billingStatus: EBillingStatus.REFUNDED, refund: _refund },
      })
      await _refund.save()
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(data.billingCycleId, {
        billingStatus: EBillingStatus.REFUNDED,
        refund: _refund,
        $push: { history: _billingCycleUpdateHistory },
      })

      // Update shipment
      const shipments = billingCycle.shipments
      await Aigle.forEach(shipments as Shipment[], async (shipment) => {
        const shipmentModel = await ShipmentModel.findById(shipment)
        const payment = await PaymentModel.findById(shipmentModel.payment).lean()

        // Update Payment model
        const _paymentUpdateHistory = new UpdateHistoryModel({
          referenceId: payment._id,
          referenceType: 'Payment',
          who: userId,
          beforeUpdate: payment,
          afterUpdate: { ...payment, status: EPaymentStatus.REFUNDED },
        })
        await _paymentUpdateHistory.save()
        await PaymentModel.findByIdAndUpdate(payment._id, {
          status: EPaymentStatus.REFUNDED,
          $push: { history: _paymentUpdateHistory },
        })

        // Update Shipment model
        await ShipmentModel.markAsRefund(shipment._id, userId, _refund)
      })

      /**
       * Sent notification
       */
      await NotificationModel.sendNotification({
        userId: billingCycle.user as string,
        varient: ENotificationVarient.INFO,
        title: 'การจองของท่านดำเนินคืนยอดชำระแล้ว',
        message: [`เราขอแจ้งให้ท่าทราบว่าใบแจ้งหนี้เลขที่ ${billingCycle.billingNumber} ของท่านดำเนินคืนยอดชำระแล้ว`],
        // infoText: 'ดูการจอง',
        // infoLink: `/main/tracking?tracking_number=${billingCycle.billingNumber}`,
      })
      /**
       * Sent email
       * TODO:
       */
    }
  }

  static async markAsNoRefund(billingCycleId: string, userId: string, reason?: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: { ...billingCycle, billingStatus: EBillingStatus.CANCELLED, cancelledDetail: reason },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, {
        billingStatus: EBillingStatus.CANCELLED,
        cancelledDetail: reason,
        $push: { history: _billingCycleUpdateHistory },
      })

      // Update shipment
      const shipments = billingCycle.shipments
      await Aigle.forEach(shipments as Shipment[], async (shipment) => {
        const shipmentModel = await ShipmentModel.findById(shipment)
        const payment = await PaymentModel.findById(shipmentModel.payment).lean()

        // Update Payment model
        const _paymentUpdateHistory = new UpdateHistoryModel({
          referenceId: payment._id,
          referenceType: 'Payment',
          who: userId,
          beforeUpdate: payment,
          afterUpdate: { ...payment, status: EPaymentStatus.CANCELLED },
        })
        await _paymentUpdateHistory.save()
        await PaymentModel.findByIdAndUpdate(payment._id, {
          status: EPaymentStatus.CANCELLED,
          $push: { history: _paymentUpdateHistory },
        })

        // Update Shipment model
        await ShipmentModel.markAsNoRefund(shipment._id, userId)
      })

      /**
       * Sent notification
       */
      await NotificationModel.sendNotification({
        userId: billingCycle.user as string,
        varient: ENotificationVarient.INFO,
        title: 'การจองของท่านไม่ได้รับการคืนยอดชำระ',
        message: [`เราขอแจ้งให้ท่าทราบว่าใบแจ้งหนี้เลขที่ ${billingCycle.billingNumber} ของท่านไม่ถูกดำเนินคืนยอดชำระ`],
        // infoText: 'ดูการจอง',
        // infoLink: `/main/tracking?tracking_number=${billingCycle.billingNumber}`,
      })
      /**
       * Sent email
       * TODO:
       */
    }
  }
}

const BillingCycleModel = getModelForClass(BillingCycle)

export default BillingCycleModel

async function getNearbyDuedateBillingCycle(before: number = 1) {
  const currentday = addDays(new Date(), before)
  const today = currentday.setHours(0, 0, 0, 0)
  const oneDaysLater = currentday.setHours(23, 59, 59, 999)
  const billingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.CURRENT,
    paymentDueDate: {
      $gte: today, // paymentDueDate หลังจากหรือเท่ากับวันนี้
      $lte: oneDaysLater // และก่อนหรือเท่ากับในอีก 1 วันข้างหน้า
    }
  }).lean()

  return billingCycles
}

export async function notifyNearby3Duedate() {
  const billingCycles = await getNearbyDuedateBillingCycle(3)
  await Aigle.forEach(billingCycles, async (billingCycle) => {
    await NotificationModel.sendNotification({
      userId: billingCycle.user as string,
      varient: ENotificationVarient.WRANING,
      title: 'ใกล้ครบกำหนดชำระ',
      message: ['อีก 3 วันจะครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน'],
      infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

export async function notifyNearby1Duedate() {
  const billingCycles = await getNearbyDuedateBillingCycle(1)
  await Aigle.forEach(billingCycles, async (billingCycle) => {
    await NotificationModel.sendNotification({
      userId: billingCycle.user as string,
      varient: ENotificationVarient.WRANING,
      title: 'ใกล้ครบกำหนดชำระ',
      message: ['พรุ่งนี้เป็นวันครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน'],
      infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

export async function notifyDuedate() {
  const billingCycles = await getNearbyDuedateBillingCycle(0)
  await Aigle.forEach(billingCycles, async (billingCycle) => {
    await NotificationModel.sendNotification({
      userId: billingCycle.user as string,
      varient: ENotificationVarient.WRANING,
      title: 'ครบกำหนดชำระ',
      message: ['ครบกำหนดชำระแล้ว กรุณาชำระเงินภายในวันที่กำหนด'],
      infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

export async function notifyOverdue() {
  /**
   * TODO: sent as customer ID
   */
  const overdueBillingCycles = await BillingCycleModel.find({ billingStatus: EBillingStatus.OVERDUE }).lean()

  await Aigle.forEach(overdueBillingCycles, async (billingCycle) => {
    const today = new Date()
    const overdate = differenceInDays(today.setHours(0, 0, 0, 0), new Date(billingCycle.paymentDueDate).setHours(0, 0, 0, 0))
    await NotificationModel.sendNotification({
      userId: billingCycle.user as string,
      varient: ENotificationVarient.ERROR,
      title: `บัญชีของท่านค้างชำระ`,
      message: [`ขณะนี้บัญชีของท่านค้างชำระ และเลยกำหนดชำระมา ${overdate} วัน`],
      infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

export async function issueBillingCycle() {
  /**
   * ISSUE
   */
  const customers = await UserModel.aggregate(GET_CUSTOMER_WITH_TODAY_BILLED_DATE())
  if (customers && !isEmpty(customers)) {
    await Aigle.forEach(customers as User[], async (customer) => {
      if (customer._id) {
        await BillingCycleModel.createBillingCycleForUser(customer._id)
      }
    })
  }
}

export async function checkBillingStatus() {
  const today = new Date()
  /**
   * OVERDUE CHECK
   */
  const overdueBillingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.CURRENT,
    paymentDueDate: { $lt: today.setHours(0, 0, 0, 0) },
  })

  await Aigle.forEach(overdueBillingCycles, async (overdueBill) => {
    await overdueBill.updateOne({ billingStatus: EBillingStatus.OVERDUE })
    const customer = await UserModel.findById(overdueBill.user)
    if (customer) {
      if (!includes([EUserStatus.INACTIVE, EUserStatus.BANNED], customer.status)) {
        await customer.updateOne({ status: EUserStatus.INACTIVE })
      }
    }
  })

  /**
   * SUSPENDED CHECK
   */
  const suspendedBillingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.OVERDUE,
    paymentDueDate: { $lt: addDays(today, -16).setHours(0, 0, 0, 0) },
  })

  let bannedCustomer = []
  await Aigle.forEach(suspendedBillingCycles, async (suspendedBill) => {
    // await suspendedBill.updateOne({ billingStatus: EBillingStatus.OVERDUE })
    const customer = await UserModel.findById(suspendedBill.user)
    if (customer) {
      if (customer.status !== EUserStatus.BANNED) {
        await NotificationModel.sendNotification({
          userId: customer._id,
          varient: ENotificationVarient.ERROR,
          title: `บัญชีของท่านถูกระงับใช้งาน`,
          message: [`ขณะนี้บัญชีของท่านถูกระงับการใช้งาน เนื่องจากมียอดค้างชำระ กรุณาติดต่อเจ้าหน้าที่`],
          infoLink: `/main/billing?billing_number=${suspendedBill.billingNumber}`,
          infoText: 'คลิกเพื่อดูรายละเอียด',
        })
        await customer.updateOne({ status: EUserStatus.BANNED })
        bannedCustomer = [...bannedCustomer, customer._id]
      }
    }
  })

  // Notify to admin
  const bannedCustomerUniq = uniq(bannedCustomer)
  if (!isEmpty(bannedCustomerUniq)) {
    const admins = await UserModel.find({ userRole: EUserRole.ADMIN, status: EUserStatus.ACTIVE })
    await Aigle.forEach(admins, async (admin) => {
      await NotificationModel.sendNotification({
        userId: admin._id,
        varient: ENotificationVarient.WRANING,
        title: `พบบัญชีค้างชำระ`,
        message: [`พบบัญชีค้างชำระ และถูกระงับใช้งานจำนวน ${bannedCustomerUniq.length} บัญชี`],
        infoLink: `/management/customer/business`,
        infoText: 'คลิกเพื่อดูรายละเอียด',
      })
    })
  }
}

export async function issueEmailToCustomer() {
  const emailTranspoter = email_sender()

  const currentDate = new Date()
  const startRange = currentDate.setHours(0, 0, 0, 0)
  const endRange = currentDate.setHours(23, 59, 59, 999)

  const billingCycles = await BillingCycleModel.find({ createdAt: { $gte: startRange, $lt: endRange } })

  await Aigle.forEach(billingCycles, async (billingCycle) => {
    const customer = await UserModel.findById(billingCycle.user)
    if (customer) {
      const financialEmails = get(customer, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = uniq([customer.email, ...financialEmails])
      const month_text = format(new Date(), 'MMMM', { locale: th })
      const year_number = toNumber(format(new Date(), 'yyyy', { locale: th }))
      const year_text = toString(year_number + 543)
      const invoiceFilePath = await generateInvoice(billingCycle)
      await emailTranspoter.sendMail({
        from: process.env.NOREPLY_EMAIL,
        to: emails,
        subject: `[Auto Email] Movemate Thailand ใบแจ้งหนี้ค่าบริการ ${billingCycle.billingNumber}`,
        template: 'notify_invoice',
        context: {
          business_name: customer.fullname,
          month_text,
          year_text,
          financial_email: 'acc@movematethailand.com',
          contact_number: '02-xxx-xxxx',
          movemate_link: `https://www.movematethailand.com`,
        },
        attachments: [
          {
            filename: path.basename(invoiceFilePath.filePath),
            path: invoiceFilePath.filePath,
          },
        ],
      })
      await BillingCycleModel.findByIdAndUpdate(billingCycle._id, { emailSendedTime: new Date() })
      console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
    }
  })
}

export async function notifyIssueEmailToCustomer() {
  const currentDate = new Date()
  const startRange = currentDate.setHours(0, 0, 0, 0)
  const endRange = currentDate.setHours(23, 59, 59, 999)

  const billingCycles = await BillingCycleModel.find({ createdAt: { $gte: startRange, $lt: endRange } }).lean()

  // console.log('---billingCycles---', billingCycles)
  await Aigle.forEach(billingCycles, async (billingCycle) => {
    console.log('billingCycle.user: ', billingCycle.user)
    await NotificationModel.sendNotification({
      userId: billingCycle.user as string,
      varient: ENotificationVarient.MASTER,
      title: 'ออกใบแจ้งหนี้แล้ว',
      message: [`ระบบได้ออกใบแจ้งหนี้หมายเลข ${billingCycle.billingNumber} แล้ว`],
      infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

const sarabunThin = path.join(__dirname, '..', 'assets/fonts/Sarabun-Thin.ttf')
const sarabunExtraLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraLight.ttf')
const sarabunLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-Light.ttf')
const sarabunRegular = path.join(__dirname, '..', 'assets/fonts/Sarabun-Regular.ttf')
const sarabunMedium = path.join(__dirname, '..', 'assets/fonts/Sarabun-Medium.ttf')
const sarabunSemiBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-SemiBold.ttf')
const sarabunBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-Bold.ttf')
const sarabunExtraBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraBold.ttf')

export async function generateInvoice(billingCycle: BillingCycle) {
  const logoPath = path.join(__dirname, '..', 'assets/images/logo_bluesky.png')
  const kbankPath = path.join(__dirname, '..', 'assets/images/kbank-full.png')
  const fileName = `invoice_${billingCycle.billingNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/invoice', fileName)

  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 56, left: 22, right: 22 } })
  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)

  function HeaderComponent(page: number, totalPage: number) {
    // Logo
    doc.image(logoPath, 22, 60, { width: 80 })

    // Company Movemate info
    doc.font(sarabunMedium).fontSize(8).text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จํากัด', 110)
    doc.font(sarabunLight).fontSize(7)
    doc.text('สาขา : (สำนักงานใหญ่)', 280, 61)
    doc.moveDown(0.8)
    doc.text('เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310', 110)
    doc.moveDown(0.6)
    doc.text('เลขประจําตัวผู้เสียภาษี: 0105564086723', 110)
    doc.moveDown(0.6)
    doc.text('ติดต่อ: 02-xxx-xxxx', 110)
    doc.moveDown(0.6)
    doc.text('อีเมล์: acc@movematethailand.com', 110)

    // Invoice number detail
    doc.font(sarabunRegular).fontSize(13).text('INVOICE', 420, 55, { align: 'center', width: 162 })
    doc.moveDown(0.3)
    doc.font(sarabunLight).fontSize(9)
    doc.text('ใบแจ้งหนี้ (ต้นฉบับ)', 420, doc.y, { align: 'center', width: 162 })
    doc
      .lineCap('butt')
      .lineWidth(1)
      .moveTo(420, doc.y + 4)
      .lineTo(582, doc.y + 4)
      .stroke()
    doc.moveDown(0.5)
    doc.fontSize(8)
    doc.font(sarabunMedium).text('Invoice No.:', 420, doc.y, { align: 'right', width: 74 }) // 81
    doc.font(sarabunLight).text(billingCycle.billingNumber, 504, doc.y - 10, { align: 'left' })
    doc.moveDown(0.3)
    doc.font(sarabunMedium).text('Date :', 420, doc.y, { align: 'right', width: 74 }) // 81

    const issueInBEDateMonth = fDate(billingCycle.issueDate, 'dd/MM')
    const issueInBEYear = toNumber(fDate(billingCycle.issueDate, 'yyyy')) + 543
    doc.font(sarabunLight).text(`${issueInBEDateMonth}/${issueInBEYear}`, 504, doc.y - 10, { align: 'left' })

    const duedateInBEDateMonth = fDate(billingCycle.paymentDueDate, 'dd/MM')
    const duedateInBEYear = toNumber(fDate(billingCycle.paymentDueDate, 'yyyy')) + 543
    doc.moveDown(0.3)
    doc.font(sarabunMedium).text('Due Date :', 420, doc.y, { align: 'right', width: 74 }) // 81
    doc.font(sarabunLight).text(`${duedateInBEDateMonth}/${duedateInBEYear}`, 504, doc.y - 10, { align: 'left' })
    doc.rect(420, 54, 162, 84).lineWidth(2).stroke()

    // Seperate line
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + 16)
      .lineTo(584, doc.y + 16)
      .stroke()

    let address = '-'
    const user = get(billingCycle, 'user', undefined) as User | undefined
    const businessDetail = get(user, 'businessDetail', undefined) as BusinessCustomer | undefined
    const paymentMethod = get(businessDetail, 'paymentMethod', '')
    if (paymentMethod === 'cash') {
      address = `${businessDetail.address} แขวง/ตำบล ${businessDetail.subDistrict} เขต/อำเภอ ${businessDetail.district} จังหวัด ${businessDetail.province} ${businessDetail.postcode}`
    } else if (paymentMethod === 'credit' && businessDetail.creditPayment) {
      const creditPayment = businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
      address = `${creditPayment.financialAddress} แขวง/ตำบล ${creditPayment.financialSubDistrict} เขต/อำเภอ ${creditPayment.financialDistrict} จังหวัด ${creditPayment.financialProvince} ${creditPayment.financialPostcode}`
    } else if (user.individualDetail) {
      const individualDetail = user.individualDetail as IndividualCustomer | undefined
      if (individualDetail.address) {
        address = `${individualDetail.address} แขวง/ตำบล ${individualDetail.subDistrict} เขต/อำเภอ ${individualDetail.district} จังหวัด ${individualDetail.province} ${individualDetail.postcode}`
      }
    }

    const isBusiness = user.userType === 'business'
    const businessBranch = get(user, 'businessDetail.businessBranch', '-')
    const taxId = isBusiness ? get(user, 'businessDetail.taxNumber', '-') : get(user, 'individualDetail.taxId', '-')
    // Customer detail
    doc.moveDown(2.8)
    doc.font(sarabunMedium).fontSize(7)
    doc.text('ชื่อลูกค้า :', 22)
    doc.text(user.fullname, 110, doc.y - 9)
    doc.font(sarabunLight)
    if (isBusiness) {
      doc.text('สาขา :', 280, doc.y - 9)
      doc.text(businessBranch, 308, doc.y - 9)
    }
    doc.moveDown(0.6)
    doc.font(sarabunMedium).text('เลขประจำตัวผู้เสียภาษี :', 22)
    doc.font(sarabunLight).text(taxId, 110, doc.y - 9)
    doc.moveDown(0.6)
    doc.font(sarabunMedium).text('ที่อยู่ :', 22)
    doc
      .font(sarabunLight)
      .text(address, 110, doc.y - 9)

    // Page detail
    doc.moveDown(2.1)
    doc.fontSize(8)
    doc.font(sarabunMedium).text('Page :', 0, doc.y, { width: 500, align: 'right' })
    doc.font(sarabunLight).text(`${page} of ${totalPage}`, 500, doc.y - 10, { align: 'center', width: 76 })
    doc.moveDown(0.5)
    doc.font(sarabunMedium).text('รายละเอียด', 22)
    doc.font(sarabunMedium).text('สกุลเงิน :', 0, doc.y - 10, { width: 500, align: 'right' })
    doc.font(sarabunLight).text('บาท (THB)', 500, doc.y - 10, { align: 'center', width: 76 })

    // Seperate line
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + 4)
      .lineTo(584, doc.y + 4)
      .stroke()

    doc.moveDown(1)
    doc.font(sarabunMedium).fontSize(7)
    doc.text('ลำดับ', 22, doc.y, { width: 32, align: 'center' })
    doc.text('วันที่ใช้บริการ', 54, doc.y - 9, { width: 64, align: 'center' })
    doc.text('หมายเลขงาน', 118, doc.y - 9, { width: 64, align: 'center' })
    doc.text('รายละเอียด', 182, doc.y - 9, { width: 260, align: 'center' })
    doc.text('จำนวนเงิน', 442, doc.y - 9, { width: 64, align: 'center' })
    doc.text('จำนวนเงินสุทธิ', 506, doc.y - 9, { width: 78, align: 'center' })
    doc.moveDown(0.5)

    // Seperate line
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + 4)
      .lineTo(584, doc.y + 4)
      .stroke()

    doc.moveDown(1)
  }

  let splitIndex: number[] = []
  let stackHeight = 0
  const maxHeight = 326
  doc.font(sarabunLight).fontSize(8)
  const billingShipments = get(billingCycle, 'shipments', []) as Shipment[]
  billingShipments.forEach((data, index) => {
    const pickup = head(data.destinations)
    const dropoffs = tail(data.destinations)
    const venicle = get(data, 'vehicleId', undefined) as VehicleType | undefined
    const details = `ค่าขนส่ง${venicle.name} ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? curr.name : `${prev}, ${curr.name}`),
      '',
    )}`
    const contentHeight = doc.heightOfString(details, { width: 260 })
    const totalHeight = contentHeight + stackHeight + 3
    if (totalHeight > maxHeight) {
      splitIndex = [...splitIndex, index]
      stackHeight = 0
    } else {
      stackHeight = totalHeight
      if (billingShipments.length - 1 === index) {
        splitIndex = [...splitIndex, index + 1]
      }
    }
  })

  const shipmentGroup = splitIndex.reduce<Shipment[][]>((prev, curr, currentIndex) => {
    if (currentIndex === 0) {
      const data = slice(billingShipments, 0, curr)
      return [data]
    } else {
      const data = slice(billingShipments, splitIndex[currentIndex - 1], curr)
      return [...prev, data]
    }
  }, [])

  let latestHeight = 0
  let rowNumber = 0

  if (isEmpty(shipmentGroup)) {
    HeaderComponent(1, 1)
  }

  forEach(shipmentGroup, (shipments, index) => {
    if (index !== 0) {
      doc
        .lineCap('butt')
        .lineWidth(1.5)
        .moveTo(22, doc.y + latestHeight + 8)
        .lineTo(584, doc.y + latestHeight + 8)
        .stroke()
      doc.addPage()
    }
    HeaderComponent(index + 1, shipmentGroup.length)
    forEach(shipments, (shipment, itemIndex) => {
      const pickup = head(shipment.destinations)
      const dropoffs = tail(shipment.destinations)
      const venicle = get(shipment, 'vehicleId', undefined) as VehicleType | undefined
      const details = `ค่าขนส่ง${venicle.name} ${pickup.name} ไปยัง ${reduce(
        dropoffs,
        (prev, curr) => (prev ? curr.name : `${prev}, ${curr.name}`),
        '',
      )}`
      const contentHeight = doc.heightOfString(details, { width: 260 })
      latestHeight = contentHeight
      const currentY = doc.y + (itemIndex === 0 ? 0 : contentHeight)
      const no = rowNumber + 1
      const payment = get(shipment, 'payment', undefined) as Payment

      doc
        .moveDown(0.5)
        .font(sarabunLight)
        .fontSize(8)
        .text(`${no}`, 22, currentY, { width: 32, align: 'center' })
        .text(fDate(shipment.bookingDateTime, 'dd/MM/yyyy'), 54, currentY, { width: 64, align: 'center' })
        .text(shipment.trackingNumber, 118, currentY, { width: 64, align: 'center' })
        .text(details, 182, currentY, { width: 260, align: 'left' })
        .text(fCurrency(payment.invoice.totalPrice || 0), 442, currentY, { width: 64, align: 'right' })
        .text(fCurrency(payment.invoice.totalPrice || 0), 506, currentY, { width: 78, align: 'right' })
    })
  })

  // Summary and Payment detail
  // Seperate line
  // doc.moveDown(2)
  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(22, doc.y + latestHeight)
    .lineTo(584, doc.y + latestHeight)
    .stroke()

  // Total detail
  doc.fontSize(8)
  doc.font(sarabunMedium).text('รวมเป็นเงิน :', 0, doc.y + latestHeight + 16, { width: 450, align: 'right' })
  doc.font(sarabunLight).text(fCurrency(billingCycle.subTotalAmount), 450, doc.y - 10, { align: 'right', width: 128 })
  if (billingCycle.taxAmount > 0) {
    doc.moveDown(1.6)
    doc.font(sarabunMedium).text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 450, align: 'right' })
    doc.font(sarabunLight).text(`-${fCurrency(billingCycle.taxAmount)}`, 450, doc.y - 10, { align: 'right', width: 128 })
  }
  doc.moveDown(2.6)
  doc.fontSize(10)
  doc.font(sarabunMedium).text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 450, align: 'right' })
  doc.font(sarabunSemiBold).text(fCurrency(billingCycle.totalAmount), 450, doc.y - 12, { align: 'right', width: 128 })
  doc
    .fontSize(7)
    .font(sarabunLight)
    .text(`( ${ThaiBahtText(billingCycle.totalAmount)} )`, 0, doc.y + 4, {
      align: 'right',
      width: 578,
    })

  // Policy detail
  doc.moveDown(3.5)
  doc.fontSize(8)
  doc.font(sarabunMedium).text('เงื่อนไขการชำระเงิน:', 22)
  doc
    .font(sarabunLight)
    .text('ภายใน 7 วันปฏิทินนับจากวันที่ออกใบแจ้งหนี้ ในกรณีที่ชำระเงินไม่ตรงตามระยะเวลาที่กำหนด', 92, doc.y - 10)
  doc.moveDown(0.3)
  doc.text(
    'บริษัทฯจะคิดค่าธรรมเนียมอัตราร้อยละ 3.0 ต่อเดือนของยอดค้างชำระจนถึงวันที่ชำระเงินครบถ้วน ทั้งนี้ Movemate มีสิทธิ์ที่จะยกเลิกส่วนลดที่เกิดขึ้นก่อนทั้งหมด',
    22,
  )

  // Bank detail
  doc.moveDown(3.5)
  doc.text('ช่องทางชำระ :')
  doc.text('ธนาคาร กสิกรไทย', 80, doc.y - 10)
  doc.image(kbankPath, 220, doc.y - 20, { width: 100 })
  doc.moveDown(0.5)
  doc.text('ชื่อบัญชี :', 22)
  doc.text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('เลขที่บัญชี :', 22)
  doc.text('117-1-54180-4', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('ประเภทบัญชี :', 22)
  doc.text('ออมทรัพย์', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('สาขา :', 22)
  doc.text('เซ็นทรัล บางนา', 80, doc.y - 10)

  // After transfer detail
  doc.moveDown(1)
  doc.fontSize(6).fillColor('#212B36')
  doc.text('เมื่อท่านได้ชำระแล้วกรุณาส่งหลักฐานการชำระ มาที่ acc@movemateth.com พร้อมอ้างอิงเลขที่ใบแจ้งหนี้', 22)
  doc.moveDown(1)
  doc.text('*หากต้องการแก้ไขใบแจ้งหนี้และใบเสร็จรับเงิน กรุณาติตต่อ acc@movemateth.com ภายใน 3 วันทำการ')
  doc.moveDown(1)
  doc.text(
    'หลังจากได้รับเอกสาร มิเช่นนั้นทำงบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบูรณ์ เป็นที่เรียบร้อยแล้ว',
  )

  const halfWidth = doc.page.width / 2

  // Signatures
  doc.moveDown(7)
  doc.fontSize(7).fillColor('#000')
  doc
    .fillColor('#919EAB')
    .text('______________________________________________________________', 0, doc.y, {
      width: halfWidth,
      align: 'center',
    })
    .text('______________________________________________________________', halfWidth, doc.y - 9, {
      width: halfWidth,
      align: 'center',
    })
  doc.moveDown(0.8)
  doc
    .fillColor('#000')
    .text('(.............................................................................)', 0, doc.y, {
      width: halfWidth,
      align: 'center',
    })
    .text('(.............................................................................)', halfWidth, doc.y - 9, {
      width: halfWidth,
      align: 'center',
    })
  doc.moveDown(0.6)
  doc
    .text('วันที่ .................... / ............................ / ...................', 0, doc.y, {
      width: halfWidth,
      align: 'center',
    })
    .text('วันที่ .................... / ............................ / ...................', halfWidth, doc.y - 9, {
      width: doc.page.width / 2,
      align: 'center',
    })
  doc.moveDown(0.6)
  doc
    .fillColor('#212B36')
    .text('(ผู้ใช้บริการ)', 0, doc.y, { width: halfWidth, align: 'center' })
    .text('(ผู้ให้บริการ)', halfWidth, doc.y - 9, { width: halfWidth, align: 'center' })

  doc.end()

  await new Promise((resolve) => writeStream.on('finish', resolve))

  await BillingCycleModel.findByIdAndUpdate(billingCycle._id, { issueInvoiceFilename: fileName })

  return { fileName, filePath }
}
