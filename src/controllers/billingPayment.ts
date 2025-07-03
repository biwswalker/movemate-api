import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import BillingModel from '@models/finance/billing.model'
import { BillingReason } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import { Shipment } from '@models/shipment.model'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import lodash, { get, includes } from 'lodash'
import { ClientSession, Types } from 'mongoose'
import { markShipmentAsNoRefund, markShipmentAsRefunded, markShipmentVerified } from './shipmentVerify'
import { addCustomerCreditUsage, updateCustomerCreditUsageBalance } from './customer'
import { getAdminMenuNotificationCount } from '@resolvers/notification.resolvers'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from '@models/transaction.model'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import PaymentEvidenceModel from '@models/finance/evidence.model'
import { format } from 'date-fns'
import { generateTrackingNumber } from '@utils/string.utils'
import ReceiptModel from '@models/finance/receipt.model'
import { generateBillingReceipt } from './billingReceipt'
import { MakePayBillingInput } from '@inputs/payment.input'
import FileModel from '@models/file.model'

Aigle.mixin(lodash, {})

interface MarkBillingAsPaidInput {
  billingId: string
  paymentId: string
  paymentDate?: Date
  imageEvidenceId?: string
}

export async function markBillingAsPaid(
  input: MarkBillingAsPaidInput,
  adminId: string,
  session?: ClientSession | null,
) {
  const { billingId, paymentId, imageEvidenceId, paymentDate } = input
  const _billing = await BillingModel.findById(billingId).session(session).lean()
  const _payment = await PaymentModel.findById(paymentId).session(session)

  if (!_billing || !_payment) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากไม่พบการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  if (
    (_payment.status === EPaymentStatus.PENDING || _billing.status === EBillingStatus.PENDING) &&
    _billing.paymentMethod === EPaymentMethod.CASH
  ) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากท่านยังไม่ได้แจ้งการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (_payment.status === EPaymentStatus.CANCELLED || _billing.status === EBillingStatus.CANCELLED) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากการชำระถูกยกเลิก โปรดตรวจสอบอีกครั้ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (_payment.status === EPaymentStatus.COMPLETE || _billing.status === EBillingStatus.COMPLETE) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากท่านชำระเงินแล้ว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  /**
   * Create evidence if it exist
   */
  let _evidenceId: Types.ObjectId | undefined = undefined
  if (imageEvidenceId) {
    const _payDate = new Date(paymentDate)
    const _evidence = new PaymentEvidenceModel({
      image: imageEvidenceId,
      paymentDate: _payDate,
      paymentTime: _payDate,
    })
    await _evidence.save({ session })
    _evidenceId = _evidence._id
  }
  /**
   * Update Payment status
   */
  await PaymentModel.findByIdAndUpdate(
    _payment._id,
    {
      status: EPaymentStatus.COMPLETE,
      ...(_evidenceId ? { $push: { evidence: _evidenceId } } : {}),
      updatedBy: adminId,
    },
    { session },
  )
  /**
   * Generate Receipt
   * Only credit customer
   */
  let _receiptId = undefined
  const today = new Date()
  if (_billing.paymentMethod === EPaymentMethod.CREDIT) {
    /**
     * สร้าง Receipt สำหรับ Credit payment
     */
    const generateMonth = format(today, 'yyMM')
    const _receiptNumber = await generateTrackingNumber(`RE${generateMonth}`, 'receipt', 3)
    const _receipt = new ReceiptModel({
      receiptNumber: _receiptNumber,
      receiptDate: today,
      document: null,
      total: _payment.total,
      subTotal: _payment.subTotal,
      tax: _payment.tax,
      updatedBy: adminId,
    })
    await _receipt.save({ session })
    _receiptId = _receipt._id
  }

  /**
   * Update Billing status
   */
  const _newBilling = await BillingModel.findByIdAndUpdate(
    _billing._id,
    {
      status: EBillingStatus.COMPLETE,
      state: EBillingState.CURRENT,
      updatedBy: adminId,
      $push: { receipts: _receiptId },
    },
    { session, new: true },
  )

  /**
   * Update Shipments if CASH payment
   */
  if (_billing.paymentMethod === EPaymentMethod.CASH) {
    await Aigle.forEach(_billing.shipments as Shipment[], async (shipment) => {
      await markShipmentVerified({ result: 'approve', shipmentId: shipment._id }, adminId, session)
    })
  } else {
    /**
     * Update Customer credit and balance
     * Only credit user
     */
    const amount = -_payment.total
    const customerId = get(_billing, 'user._id', '')
    await updateCustomerCreditUsageBalance(customerId, amount, session)
    /**
     * generate receipt
     */
    const documentId = await generateBillingReceipt(_billing._id, true, session)
    await ReceiptModel.findByIdAndUpdate(_receiptId, { document: documentId }, { session })
  }

  await getAdminMenuNotificationCount()

  return _newBilling
}

interface MarkBillingAsRejectedInput {
  billingId: string
  paymentId: string
  reason?: string
}

export async function markBillingAsRejected(
  input: MarkBillingAsRejectedInput,
  adminId: string,
  session?: ClientSession,
) {
  const { billingId, paymentId, reason } = input
  const _billing = await BillingModel.findById(billingId).session(session).lean()
  const _payment = await PaymentModel.findById(paymentId).session(session).lean()
  if (!_billing || !_payment) {
    const message = 'ไม่สามารถดำเนินยกเลิกการชำระได้ เนื่องจากไม่พบการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  if (_payment.status === EPaymentStatus.CANCELLED || _billing.status === EBillingStatus.CANCELLED) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากการชำระถูกยกเลิก โปรดตรวจสอบอีกครั้ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (_payment.status === EPaymentStatus.COMPLETE || _billing.status === EBillingStatus.COMPLETE) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากท่านชำระเงินแล้ว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  await PaymentModel.findByIdAndUpdate(_payment._id, {
    status: EPaymentStatus.PENDING,
    type: EPaymentType.REFUND,
  })

  const _reason: BillingReason = {
    detail: reason,
    type: EBillingReason.REJECTED_PAYMENT,
  }

  await BillingModel.findByIdAndUpdate(
    _billing._id,
    {
      status: EBillingStatus.PENDING,
      state: EBillingState.REFUND,
      $push: { reasons: _reason },
    },
    { session },
  )

  if (_billing.paymentMethod === EPaymentMethod.CASH) {
    await Aigle.forEach(_billing.shipments as Shipment[], async (shipment) => {
      /**
       * TODO:
       * When Payment type PAY rejected
       * - So what we do -> (Cancelled shipment or not action with shipment) หรือเพิ่ม ADDITONAL_PAY และจับจากตัวนี้และไม่เข้าสู่การ cancelled
       * - ถ้า Reject addditional pay จะเข้า process การคืนเงิน driver เลยไหมหรือยังไง
       *
       */
      await markShipmentVerified({ result: 'reject', shipmentId: shipment._id, reason }, adminId, session)
    })
  }

  await getAdminMenuNotificationCount()
}

interface MarkBillingAsRefundInput {
  isRefunded: boolean
  billingId: string
  paymentId: string

  reason?: string
  imageEvidenceId?: string
  paymentDate?: Date
  paymentTime?: Date
}

export async function markBillingAsRefunded(input: MarkBillingAsRefundInput, adminId: string, session?: ClientSession) {
  const { billingId, paymentId, isRefunded, reason, imageEvidenceId, paymentDate, paymentTime } = input
  const _billing = await BillingModel.findById(billingId).session(session).lean()
  const _payment = await PaymentModel.findById(paymentId).session(session).lean()

  if (!_billing || !_payment) {
    const message = 'ไม่สามารถดำเนินการคืนเงินได้ เนื่องจากไม่พบการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (!includes([EBillingState.REFUND, EBillingState.CURRENT], _billing.state)) {
    const message = 'ไม่สามารถดำเนินการคืนเงินได้ เนื่องจากมีสถานะที่ไม่ใช่คืนเงิน'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (_billing.state === EBillingState.REFUND && _payment.status === EPaymentStatus.COMPLETE) {
    const message = 'ไม่สามารถดำเนินการคืนเงินได้ เนื่องจากมีสถานะคืนเงินไปแล้ว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (
    (_payment.type === EPaymentType.REFUND && _payment.status === EPaymentStatus.COMPLETE) ||
    (_payment.type === EPaymentType.CHANGE && _payment.status === EPaymentStatus.COMPLETE)
  ) {
    const message = 'ไม่สามารถดำเนินการคืนเงินได้ เนื่องจากมีสถานะคืนเงินไปแล้ว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  let _evidenceId: Types.ObjectId | undefined = undefined
  if (imageEvidenceId && paymentDate && paymentTime) {
    const _evidence = new PaymentEvidenceModel({
      image: imageEvidenceId,
      paymentDate: new Date(paymentDate),
      paymentTime: new Date(paymentTime),
    })
    await _evidence.save({ session })
    _evidenceId = _evidence._id
  }

  await PaymentModel.findByIdAndUpdate(
    _payment._id,
    { status: isRefunded ? EPaymentStatus.COMPLETE : EPaymentStatus.CANCELLED, $push: { evidence: _evidenceId } },
    { session },
  )

  let _reason: BillingReason | undefined = undefined
  if (!isRefunded && reason) {
    _reason = {
      detail: reason,
      type: EBillingReason.NOREFUND_PAYMENT,
    }
  }

  const _newBillingStatus =
    _payment.type === EPaymentType.CHANGE
      ? EBillingStatus.COMPLETE
      : isRefunded
      ? EBillingStatus.COMPLETE
      : EBillingStatus.CANCELLED
  await BillingModel.findByIdAndUpdate(
    _billing._id,
    { status: _newBillingStatus, ...(_reason ? { $push: { reasons: _reason } } : {}) },
    { session },
  )

  if (isRefunded) {
    const _movemateTransaction = new TransactionModel({
      amountTax: 0, // WHT
      amountBeforeTax: _payment.subTotal,
      amount: _payment.total,
      ownerId: MOVEMATE_OWNER_ID,
      ownerType: ETransactionOwner.MOVEMATE,
      description: `คืนเงินหมายเลขใบแจ้งหนี้ ${_billing.billingNumber}`,
      refId: _billing._id,
      refType: ERefType.BILLING,
      transactionType: ETransactionType.OUTCOME,
      status: ETransactionStatus.COMPLETE,
    })
    await _movemateTransaction.save({ session })
  }

  if (_billing.state === EBillingState.REFUND) {
    /**
     * Cancelled shipments
     * Only billing state REFUND no CHANGE
     */
    await Aigle.forEach(_billing.shipments as Shipment[], async (shipment) => {
      if (isRefunded) {
        await markShipmentAsRefunded(shipment._id, adminId, session)
      } else {
        await markShipmentAsNoRefund(shipment._id, adminId, session)
      }
    })
  }

  const isCreditPayment = _billing.paymentMethod === EPaymentMethod.CREDIT
  if (isCreditPayment) {
    /**
     * Update customer balance
     */
    await addCustomerCreditUsage(_billing.user.toString(), _payment.total, session)
  }

  /**
   * Sent notification
   */
  const _billingNumber = _billing.billingNumber
  const message = isCreditPayment
    ? [`เราขอแจ้งให้ท่าทราบว่าใบแจ้งหนี้เลขที่ ${_billingNumber} ของท่านดำเนินคืนยอดชำระแล้ว`]
    : [`เราขอแจ้งให้ท่าทราบว่างานขนส่งหมายเลข ${_billingNumber} ของท่านดำเนินคืนยอดชำระแล้ว`]
  const infoText = isCreditPayment ? 'ดูข้อมูลการเงิน' : 'ดูงานขนส่ง'
  const infoLink = isCreditPayment
    ? `/main/billing?billing_number=${_billingNumber}`
    : `/main/tracking?tracking_number=${_billingNumber}`
  await NotificationModel.sendNotification({
    userId: get(_billing, 'user._id', '') as string,
    varient: ENotificationVarient.SUCCESS,
    title: 'การจองของท่านดำเนินคืนยอดชำระแล้ว',
    message,
    infoText,
    infoLink,
  })
}

export async function makePayBilling(
  data: MakePayBillingInput,
  billingId: string,
  paymentId: string,
  session?: ClientSession | null,
) {
  const { bank, bankName, bankNumber, image, paymentDate, paymentTime } = data
  const _billing = await BillingModel.findById(billingId).session(session).lean()
  const _payment = await PaymentModel.findById(paymentId).session(session)

  if (!_billing || !_payment) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากไม่พบการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  if (_payment.status !== EPaymentStatus.PENDING || _payment.type !== EPaymentType.PAY) {
    const message = 'ไม่สามารถดำเนินการชำระได้ เนื่องจากท่านยังไม่ได้อยู่ขั้นตอนการชำระ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  /**
   * Create evidence image
   */
  const _evidenceImage = new FileModel(image)
  await _evidenceImage.save({ session })
  const _evidence = new PaymentEvidenceModel({
    image: _evidenceImage,
    bank,
    bankName,
    bankNumber,
    paymentDate,
    paymentTime,
  })
  await _evidence.save({ session })
  /**
   * Update Payment status
   */
  await PaymentModel.findByIdAndUpdate(paymentId, {
    status: EPaymentStatus.VERIFY,
    $push: { evidence: _evidence },
  })

  await getAdminMenuNotificationCount()

  return true
}
