import { Field, Float, ID, ObjectType, registerEnumType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import UserModel, { EUserRole, EUserStatus, EUserType, User } from './user.model'
import ShipmentModel, { EDriverAcceptanceStatus, EShipingStatus, Shipment } from './shipment.model'
import BillingPaymentModel, { BillingPayment, EBillingPaymentStatus } from './billingPayment.model'
import { BusinessCustomer } from './customerBusiness.model'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from './customerBusinessCreditPayment.model'
import lodash, {
  get,
  isEmpty,
  reduce,
  sum,
  toNumber,
  toString,
  uniq,
  includes,
  isEqual,
  head,
  tail,
  find,
  last,
  filter,
} from 'lodash'
import { addDays, addMonths, differenceInDays, differenceInMinutes, format } from 'date-fns'
import { EPaymentMethod, EPaymentRejectionReason, Payment } from './payment.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GET_CUSTOMER_WITH_TODAY_BILLED_DATE } from '@pipelines/user.pipeline'
import addEmailQueue from '@utils/email.utils'
import { th } from 'date-fns/locale'
import path from 'path'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { AggregatePaginateModel, Types } from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import PaymentModel, { EPaymentStatus } from './payment.model'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import { IsEnum } from 'class-validator'
import RefundModel, { ERefundStatus, Refund } from './refund.model'
import NotificationModel, { ENotificationVarient } from './notification.model'
import { getAdminMenuNotificationCount } from '@resolvers/notification.resolvers'
import { generateInvoice } from 'reports/invoice'
import BillingReceiptModel, { BillingReceipt } from './billingReceipt.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from './transaction.model'
import { VehicleType } from './vehicleType.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import { generateReceipt } from 'reports/receipt'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from './shipmentStepDefinition.model'
import pubsub, { SHIPMENTS } from '@configs/pubsub'

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
registerEnumType(EBillingStatus, {
  name: 'EBillingStatus',
  description: 'Billing status',
})

interface MarkAsPaidPaymentProps {
  billingCycleId: string
  paymentNumber: string
  paymentAmount: number
  paymentDate: Date
  imageEvidenceId?: string
  bank?: string
  bankName?: string
  bankNumber?: string
  userId?: string
}

interface MarkAsRefundProps {
  billingCycleId: string
  imageEvidenceId: string
  paymentDate: Date
  paymentTime: Date
}

@ObjectType()
export class PostalDetail {
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

  @Field(() => BillingReceipt, { nullable: true })
  @Property({ ref: () => BillingReceipt, autopopulate: true })
  billingReceipt?: Ref<BillingReceipt>

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
  emailSendedReceiptTime: Date // TODO:

  @Field({ nullable: true })
  @Property({ required: false })
  receivedWHTDocumentTime: Date // TODO:

  @Field({ nullable: true })
  @Property({ required: false })
  postalInvoice: PostalDetail

  @Field({ nullable: true })
  @Property({ required: false })
  postalReceipt: PostalDetail // TODO:

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

  @Field({ nullable: true })
  @Property({ required: false })
  issueReceiptFilename: string

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

          const shipmentsRaw = await ShipmentModel.find({
            customer: userId,
            status: EShipingStatus.DELIVERED,
            deliveredDate: { $gte: shipmentStartDeliveredDate, $lte: shipmentEndDeliveredDate },
          })

          const shipments = filter(shipmentsRaw, (shipment) => {
            const paymentMethod = get(shipment, 'payment.paymentMethod', '')
            const isCredit = paymentMethod === EPaymentMethod.CREDIT
            return isCredit
          })
          // .populate({ path: 'payment', match: { paymentMethod: EPaymentMethod.CREDIT } })

          if (isEmpty(shipments)) {
            return // If Empty shipment won't create an billing
          }

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

          const _monthyear = format(new Date(), 'yyMM')
          const _billingNumber = await generateTrackingNumber(`IV${_monthyear}`, 'invoice')
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

          // Update Outstanding Balance
          const newBalance = sum([creditPayment.creditOutstandingBalance, totalAmount])
          await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(creditPayment._id, {
            creditOutstandingBalance: newBalance,
          })
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
    userId,
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
        ...(userId ? { updatedBy: userId } : {}),
      })
      await payment.save()

      await billingCycle.updateOne({
        billingPayment: payment,
        billingStatus: EBillingStatus.VERIFY,
      })
    }
  }

  static async markAsPaid(billingCycleId: string, userId: string, paymentDate?: string, imageEvidenceId?: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      let _billingPayment = null
      // Billing Payment
      if (billingCycle.billingPayment) {
        await BillingPaymentModel.findByIdAndUpdate(billingCycle.billingPayment, {
          status: EBillingPaymentStatus.PAID,
          updatedBy: userId,
        })
      } else {
        const _paymentNumber = await generateTrackingNumber(
          billingCycle.paymentMethod === EPaymentMethod.CREDIT ? 'MMPAYCE' : 'MMPAYCA',
          'payment',
        )
        _billingPayment = new BillingPaymentModel({
          paymentNumber: _paymentNumber,
          paymentAmount: billingCycle.totalAmount,
          paymentDate: paymentDate || new Date(),
          status: EBillingPaymentStatus.PAID,
          ...(imageEvidenceId ? { imageEvidence: imageEvidenceId } : {}),
          updatedBy: userId,
        })
        await _billingPayment.save()
      }
      // Billing Receipt
      const generateMonth = format(new Date(), 'yyMM')
      const _receiptNumber = await generateTrackingNumber(`RE${generateMonth}`, 'receipt')
      const _billingReceipt = new BillingReceiptModel({
        paidAmount: billingCycle.totalAmount,
        receiptDate: new Date(),
        receiptNumber: _receiptNumber,
        updatedBy: userId,
      })
      await _billingReceipt.save()
      // Billing Cycle
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: {
          ...billingCycle,
          billingStatus: EBillingStatus.PAID,
          billingReceipt: _billingReceipt._id,
          ...(_billingPayment ? { billingPayment: get(_billingPayment, '_id', '') } : {}),
        },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, {
        billingStatus: EBillingStatus.PAID,
        ...(_billingPayment ? { billingPayment: _billingPayment } : {}),
        billingReceipt: _billingReceipt,
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

      // ** Generate receipt sent at Finish job shipment **
      // const billingCycleAfterSave = await BillingCycleModel.findById(billingCycle._id)
      // await generateReceipt(billingCycleAfterSave)

      // Change Status
      const customerId = get(billingCycle, 'user._id', '')
      if (customerId) {
        // Check other billing is overdue
        const customerModel = await UserModel.findById(customerId)
        const creditPaymentId = get(customerModel, 'businessDetail.creditPayment._id', '')
        if (billingCycle.paymentMethod === EPaymentMethod.CREDIT && creditPaymentId) {
          const creditPayment = await BusinessCustomerCreditPaymentModel.findById(creditPaymentId)
          const newCreditOutstandingBalance = sum([creditPayment.creditOutstandingBalance, -billingCycle.totalAmount])
          const newCreditBalance = sum([creditPayment.creditUsage, -billingCycle.totalAmount])
          await creditPayment.updateOne({
            creditUsage: newCreditBalance,
            creditOutstandingBalance: newCreditOutstandingBalance,
          })
        }
        // const creditDetail = awa/
        const billingCycles = await BillingCycleModel.find({
          user: customerId,
          billingStatus: EBillingStatus.OVERDUE,
        }).lean()
        if (isEmpty(billingCycles)) {
          await UserModel.findByIdAndUpdate(customerId, { status: EUserStatus.ACTIVE })
        }
      }

      // Trigger admin notification
      await getAdminMenuNotificationCount()
    }
  }

  static async rejectedPayment(billingCycleId: string, userId: string, reason?: string, otherReason?: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      const billingPayment = await BillingPaymentModel.findById(billingCycle.billingPayment)
      await billingPayment.updateOne({ status: EBillingPaymentStatus.FAILED })
      const _refund = new RefundModel({
        updatedBy: userId,
        refundAmout: billingPayment.paymentAmount,
        refundStatus: ERefundStatus.PENDING,
      })
      await _refund.save()
      // Update Biling cycle model
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: {
          ...billingCycle,
          refund: _refund,
          billingStatus: EBillingStatus.REFUND,
          rejectedReason: reason,
          rejectedDetail: otherReason,
        },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(billingCycle._id, {
        billingStatus: EBillingStatus.REFUND,
        refund: _refund,
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
        await ShipmentModel.markAsCashVerified(shipment._id, 'reject', userId, reason, otherReason, _refund._id)
      })

      // Trigger admin notification
      await getAdminMenuNotificationCount()
    }
  }

  static async markAsRefund(data: MarkAsRefundProps, userId: string) {
    const billingCycle = await BillingCycleModel.findById(data.billingCycleId).lean()
    if (billingCycle) {
      const refundModel = await RefundModel.findByIdAndUpdate(billingCycle.refund, {
        imageEvidence: data.imageEvidenceId,
        paymentDate: data.paymentDate,
        paymentTime: data.paymentTime,
        refundStatus: ERefundStatus.SUCCESS,
      })
      const _billingCycleUpdateHistory = new UpdateHistoryModel({
        referenceId: data.billingCycleId,
        referenceType: 'BillingCycle',
        who: userId,
        beforeUpdate: billingCycle,
        afterUpdate: { ...billingCycle, billingStatus: EBillingStatus.REFUNDED },
      })
      await _billingCycleUpdateHistory.save()
      await BillingCycleModel.findByIdAndUpdate(data.billingCycleId, {
        billingStatus: EBillingStatus.REFUNDED,
        $push: { history: _billingCycleUpdateHistory },
      })

      // For Movemate transaction
      const movemateTransaction = new TransactionModel({
        amount: refundModel.refundAmout,
        ownerId: MOVEMATE_OWNER_ID,
        ownerType: ETransactionOwner.MOVEMATE,
        description: `คืนเงินหมายเลขใบแจ้งหนี้ ${billingCycle.billingNumber}`,
        refId: billingCycle._id,
        refType: ERefType.BILLING,
        transactionType: ETransactionType.OUTCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await movemateTransaction.save()

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
        await ShipmentModel.markAsRefund(shipment._id, userId)
      })

      /**
       * Sent notification
       */
      if (billingCycle.paymentMethod === EPaymentMethod.CASH) {
        const shipment = get(shipments, 0, undefined) as Shipment | undefined
        if (shipment) {
          await NotificationModel.sendNotification({
            userId: billingCycle.user as string,
            varient: ENotificationVarient.SUCCESS,
            title: 'การจองของท่านดำเนินคืนยอดชำระแล้ว',
            message: [`เราขอแจ้งให้ท่าทราบว่างานขนส่งหมายเลข ${shipment.trackingNumber} ของท่านดำเนินคืนยอดชำระแล้ว`],
            infoText: 'ดูงานขนส่ง',
            infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
          })
        }
      } else {
        await NotificationModel.sendNotification({
          userId: billingCycle.user as string,
          varient: ENotificationVarient.SUCCESS,
          title: 'การจองของท่านดำเนินคืนยอดชำระแล้ว',
          message: [`เราขอแจ้งให้ท่าทราบว่าใบแจ้งหนี้เลขที่ ${billingCycle.billingNumber} ของท่านดำเนินคืนยอดชำระแล้ว`],
          infoText: 'ดูข้อมูลการเงิน',
          infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
        })
      }
      /**
       * Sent email
       * TODO:
       */
    }
  }

  static async markAsNoRefund(billingCycleId: string, userId: string, reason?: string) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId).lean()
    if (billingCycle) {
      await RefundModel.findByIdAndUpdate(billingCycle.refund, { refundStatus: ERefundStatus.CANCELLED })
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
      if (billingCycle.paymentMethod === EPaymentMethod.CASH) {
        const shipment = get(shipments, 0, undefined) as Shipment | undefined
        if (shipment) {
          await NotificationModel.sendNotification({
            userId: billingCycle.user as string,
            varient: ENotificationVarient.WRANING,
            title: 'การจองของท่านไม่ได้รับการคืนยอดชำระ',
            message: [`เราขอแจ้งให้ท่าทราบว่างานขนส่งหมายเลข ${shipment.trackingNumber} ของท่านไม่ถูกดำเนินคืนยอดชำระ`],
            infoText: 'ดูงานขนส่ง',
            infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
          })
        }
      } else {
        await NotificationModel.sendNotification({
          userId: billingCycle.user as string,
          varient: ENotificationVarient.WRANING,
          title: 'การจองของท่านไม่ได้รับการคืนยอดชำระ',
          message: [
            `เราขอแจ้งให้ท่าทราบว่าใบแจ้งหนี้เลขที่ ${billingCycle.billingNumber} ของท่านไม่ถูกดำเนินคืนยอดชำระ`,
          ],
          infoText: 'ดูข้อมูลการเงิน',
          infoLink: `/main/billing?billing_number=${billingCycle.billingNumber}`,
        })
      }
      /**
       * Sent email
       * TODO:
       */
    }
  }

  static async customerRefund(shipmentId: string, userId: string, reason: string, reasonDetail: string) {
    const shipment = await ShipmentModel.findOne({ _id: shipmentId, customer: userId })
    if (!shipment) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่ง'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const currentDate = new Date()
    const payment = shipment.payment as Payment
    const driver = shipment.driver as User
    const isCashPayment = isEqual(payment.paymentMethod, EPaymentMethod.CASH)

    const isDriverAccepted =
      isEqual(shipment.driverAcceptanceStatus, EDriverAcceptanceStatus.ACCEPTED) && shipment.driver

    function calculateRefundPrice() {
      const fullPaymentAmount = get(payment, 'invoice.totalPrice', 0)
      const fullCostAmount = get(payment, 'invoice.totalCost', 0)

      const vehicle = shipment.vehicleId as VehicleType
      const typeVehicle = get(vehicle, 'type', '')
      const differenceTime = differenceInMinutes(currentDate, shipment.bookingDateTime)
      console.log('differenceTime: ', differenceTime)

      const urgentCancellingTime = isEqual(typeVehicle, '4W') ? 40 : 90
      const middleCancellingTime = isEqual(typeVehicle, '4W') ? 120 : 180
      if (differenceTime <= urgentCancellingTime) {
        // Make refund 0% || คิดค่าใช้จ่าย 100%
        return {
          forDriver: fullCostAmount,
          forCustomer: 0,
          description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${urgentCancellingTime} นาที`,
        }
      } else if (differenceTime > urgentCancellingTime && differenceTime <= middleCancellingTime) {
        // Make refund 50% || คิดค่าใช้จ่าย 50%
        const percentToCalc = 50 / 100
        return {
          forDriver: percentToCalc * fullCostAmount,
          forCustomer: percentToCalc * fullPaymentAmount,
          description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${middleCancellingTime} นาที`,
        }
      } else {
        // Make refund 100% || ไม่เสียค่าใช้จ่าย
        return {
          forDriver: 0,
          forCustomer: fullPaymentAmount,
          description: `ผู้ใช้ยกเลิกงานขนส่ง`,
        }
      }
    }

    /**
     * TODO:// Recheck refund price
     * ถ้า refund โดยมีค่าใช้จ่าย 100% จะต้อง handle ยังไง สถานะไป cancelled เลยไหม
     * -> If _refundPrice > 0
     * --> ? billing status = EBillingStatus.REFUND, refundStatus = ERefundStatus.PENDING
     * --> : billing status = EBillingStatus.CANCELLED, refundStatus = ERefundStatus.CANCELLED
     */
    const { description, forCustomer, forDriver } = calculateRefundPrice()
    const _refund = new RefundModel({
      updatedBy: userId,
      refundAmout: forCustomer,
      refundStatus: ERefundStatus.PENDING,
    })
    await _refund.save()

    // เพิ่ม transaction income ให้กับ driver
    if (isDriverAccepted && driver) {
      const driverTransaction = new TransactionModel({
        amount: forDriver,
        ownerId: driver._id,
        ownerType: ETransactionOwner.DRIVER,
        description: description,
        refId: shipment._id,
        refType: ERefType.SHIPMENT,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.PENDING,
      })
      await driverTransaction.save()
    }

    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(shipment.steps) as StepDefinition

    if (isCashPayment) {
      // หากเป็น cash payment ให้เปลี่ยนสถานะ refund billing cycle
      await refundCashBillingCycle(shipment._id, _refund._id, reasonDetail)

      if (currentStep) {
        const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
        await Aigle.forEach(deniedSteps, async (step) => {
          await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED })
        })
        // Add customer cancelled step
        const customerCancelledSeq = lastStep.seq + 1
        const customerCancelledStep = new StepDefinitionModel({
          step: EStepDefinition.CUSTOMER_CANCELLED,
          seq: customerCancelledSeq,
          stepName: EStepDefinitionName.CUSTOMER_CANCELLED,
          customerMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
          driverMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
          stepStatus: EStepStatus.DONE,
        })
        await customerCancelledStep.save()
        // Add refund step
        const newLatestSeq = lastStep.seq + 2
        const refundStep = new StepDefinitionModel({
          step: EStepDefinition.REFUND,
          seq: newLatestSeq,
          stepName: EStepDefinitionName.REFUND,
          customerMessage: EStepDefinitionName.REFUND,
          driverMessage: EStepDefinitionName.REFUND,
          stepStatus: EStepStatus.PROGRESSING,
        })
        await refundStep.save()

        // Update shipment status
        await ShipmentModel.findByIdAndUpdate(shipment._id, {
          status: EShipingStatus.REFUND,
          refund: _refund,
          cancellationReason: reason,
          cancellationDetail: reasonDetail,
          driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
          cancelledDate: currentDate,
          currentStepSeq: newLatestSeq,
          $push: { steps: [customerCancelledStep._id, refundStep._id] },
        })
      }

      /**
       * Notification & Email
       * (Done) To Customer
       * (Skip) To Driver & FCM to Driver
       * To Admin
       *
       * update system transactions
       */
      await NotificationModel.sendNotification({
        userId,
        varient: ENotificationVarient.WRANING,
        title: 'การจองของท่านถูกยกเลิกแล้ว',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดยท่านเอง`,
          'ระบบกำลังคำนวนยอดคืนเงิน และจะดำเนินการคืนให้ท่านในไม่ช้า',
        ],
        infoText: 'ดูงานขนส่ง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
    } else {
      // Credit process
      const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
      if (currentStep) {
        const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
        await Aigle.forEach(deniedSteps, async (step) => {
          await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED })
        })
        // Add customer cancelled step
        const customerCancelledSeq = lastStep.seq + 1
        const customerCancelledStep = new StepDefinitionModel({
          step: EStepDefinition.CUSTOMER_CANCELLED,
          seq: customerCancelledSeq,
          stepName: EStepDefinitionName.CUSTOMER_CANCELLED,
          customerMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
          driverMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
          stepStatus: EStepStatus.DONE,
        })
        await customerCancelledStep.save()

        const user = await UserModel.findById(shipment.customer)
        const creditDetail = get(user, 'businessDetail.creditPayment', undefined) as
          | BusinessCustomerCreditPayment
          | undefined
        if (creditDetail) {
          const newCreditBalance = creditDetail.creditUsage - forCustomer
          await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(creditDetail._id, {
            creditUsage: newCreditBalance,
          })
        }
        // Update shipment status
        await ShipmentModel.findByIdAndUpdate(shipment._id, {
          status: EShipingStatus.CANCELLED,
          refund: _refund,
          driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
          cancellationReason: reason,
          cancellationDetail: reasonDetail,
          cancelledDate: currentDate,
          currentStepSeq: customerCancelledSeq,
          $push: { steps: customerCancelledStep._id },
        })
      }
      /**
       * Notification & Email
       * (Done) To Customer
       * (Skip) To Driver & FCM to Driver
       * To Admin
       *
       * update system transactions
       */
      await NotificationModel.sendNotification({
        userId,
        varient: ENotificationVarient.WRANING,
        title: 'การจองของท่านถูกยกเลิกแล้ว',
        message: [`เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดยท่านเอง`],
        infoText: 'ดูงานขนส่ง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
    }

    const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
    await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
    console.log(`Shipment ${shipmentId} is cancelled.`)
  }

  static async driverRefund(shipmentId: string, userId: string, reason: string, reasonDetail: string) {
    const currentDate = new Date()

    /**
     * Notification & Email
     * To Customer
     * To Driver & FCM to Driver
     * To Admin
     *
     */

    const shipmentModel = await ShipmentModel.findByIdAndUpdate(shipmentId, {
      status: EShipingStatus.IDLE,
      driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
      driver: undefined,
      cancellationDetail: reasonDetail,
      cancellationReason: reason,
      cancelledDate: currentDate,

      currentStepSeq: 0,
      steps: [],
    })
    await shipmentModel.initialStepDefinition(true)
    /**
     * Add to JOB notification
     */
  }

  static async generateShipmentReceipt(shipmentId: string, sentEmail?: boolean) {
    /**
     * Generate receipt
     */
    const billingCycle = await BillingCycleModel.findOne({ shipments: { $in: [shipmentId] } })
    const { filePath, fileName } = await generateReceipt(billingCycle)

    /**
     * Email
     */
    if (sentEmail) {
      const shipment = await ShipmentModel.findById(shipmentId)
      const customerModel = await UserModel.findById(billingCycle.user)
      if (shipment && customerModel) {
        const financialEmails = get(customerModel, 'businessDetail.creditPayment.financialContactEmails', [])
        const emails = uniq([customerModel.email, ...financialEmails])

        const pickup = head(shipment.destinations)?.name || ''
        const dropoffs = reduce(
          tail(shipment.destinations),
          (prev, curr) => {
            if (curr.name) {
              return prev ? `${prev}, ${curr.name}` : curr.name
            }
            return prev
          },
          '',
        )

        const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${shipment.trackingNumber}`
        await addEmailQueue({
          from: process.env.NOREPLY_EMAIL,
          to: emails,
          subject: `ใบเสร็จรับเงิน Movemate Thailand | Shipment No. ${shipment.trackingNumber}`,
          template: 'cash_receipt',
          context: {
            tracking_number: shipment.trackingNumber,
            fullname: customerModel.fullname,
            phone_number: customerModel.contactNumber,
            email: customerModel.email,
            customer_type: customerModel.userType === 'individual' ? 'ส่วนบุคคล' : 'บริษัท/องค์กร',
            pickup,
            dropoffs,
            tracking_link,
            contact_number: '02-xxx-xxxx',
            movemate_link: `https://www.movematethailand.com`,
          },
          attachments: [{ filename: fileName, path: filePath }],
        })
        await billingCycle.updateOne({ emailSendedReceiptTime: new Date() })
        console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
      }
    }
  }
}

const BillingCycleModel = getModelForClass(BillingCycle)

export default BillingCycleModel

export async function refundCashBillingCycle(shipmentId: string, refundId: string, reason: string) {
  const billingCycleModel = await BillingCycleModel.findOne({
    shipments: { $in: [shipmentId] },
    paymentMethod: EPaymentMethod.CASH,
  })
  if (billingCycleModel) {
    await billingCycleModel.updateOne({
      billingStatus: EBillingStatus.REFUND,
      cancelledDetail: reason,
      refund: refundId,
    })
  }
}

async function getNearbyDuedateBillingCycle(before: number = 1) {
  const currentday = addDays(new Date(), before)
  const today = currentday.setHours(0, 0, 0, 0)
  const oneDaysLater = currentday.setHours(23, 59, 59, 999)
  const billingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.CURRENT,
    paymentDueDate: {
      $gte: today, // paymentDueDate หลังจากหรือเท่ากับวันนี้
      $lte: oneDaysLater, // และก่อนหรือเท่ากับในอีก 1 วันข้างหน้า
    },
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
    const overdate = differenceInDays(
      today.setHours(0, 0, 0, 0),
      new Date(billingCycle.paymentDueDate).setHours(0, 0, 0, 0),
    )
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
      await addEmailQueue({
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
