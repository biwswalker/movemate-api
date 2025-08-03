import { EBillingReason, EBillingState, EBillingStatus, EReceiptType, ERefundAmountType } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import BillingModel from '@models/finance/billing.model'
import { BillingReason } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import lodash, { filter, get, includes } from 'lodash'
import { ClientSession, Types } from 'mongoose'
import { markShipmentAsNoRefund, markShipmentAsRefunded, markShipmentVerified } from './shipmentVerify'
import { addCustomerCreditUsage, updateCustomerCreditUsageBalance } from './customer'
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
import { generateMonthlySequenceNumber, generateTrackingNumber } from '@utils/string.utils'
import ReceiptModel, { Receipt } from '@models/finance/receipt.model'
import { generateBillingReceipt } from './billingReceipt'
import { MakePayBillingInput } from '@inputs/payment.input'
import FileModel from '@models/file.model'
import { revertShipmentRejection } from './shipmentOperation'
import { EAdminAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import RefundNoteModel from '@models/finance/refundNote.model'
import { generateCashReceipt } from 'reports/cashReceipt'
import { generateRefundReceipt } from 'reports/refundReceipt'
import { User } from '@models/user.model'
import { EUserType } from '@enums/users'

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
  const _billing = await BillingModel.findById(billingId).session(session)
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
  const _finalReceipt = filter(_billing.receipts as Receipt[], (receipt) => receipt.receiptType === EReceiptType.FINAL)
  const receiptLength = _finalReceipt.length
  const today = new Date()
  if (_billing.paymentMethod === EPaymentMethod.CREDIT || receiptLength > 0) {
    /**
     * สร้าง Receipt สำหรับ Credit payment หรือการชำระเงินสดที่ออกใบเสร็จแล้
     */
    const _receiptNumber = await generateMonthlySequenceNumber('receipt')
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
      const currentShipmentState = await ShipmentModel.findById(shipment._id).session(session).lean()
      if (
        currentShipmentState &&
        currentShipmentState.status === EShipmentStatus.IDLE &&
        currentShipmentState.adminAcceptanceStatus === EAdminAcceptanceStatus.PENDING
      ) {
        await markShipmentVerified({ result: 'approve', shipmentId: shipment._id }, adminId, session)
      } else {
        // If the shipment is already delivered, just ensure financial records are updated,
        // and optionally generate a new receipt if this is for an additional payment.
        // The core status change is handled by the billing resolver's top-level check.
        console.log(`Skipping markShipmentVerified for delivered/in-progress shipment ${shipment.trackingNumber}.`)
      }
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

  await PaymentModel.findByIdAndUpdate(
    _payment._id,
    {
      status: EPaymentStatus.PENDING,
      type: EPaymentType.REFUND,
    },
    { session },
  )

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
       */
      const currentShipmentState = await ShipmentModel.findById(shipment._id).session(session).lean()
      if (
        currentShipmentState &&
        currentShipmentState.status === EShipmentStatus.IDLE &&
        currentShipmentState.adminAcceptanceStatus === EAdminAcceptanceStatus.PENDING
      ) {
        await markShipmentVerified({ result: 'reject', shipmentId: shipment._id, reason }, adminId, session)
      } else {
        // If the shipment is already delivered, just ensure financial records are updated,
        // and optionally generate a new receipt if this is for an additional payment.
        // The core status change is handled by the billing resolver's top-level check.
        console.log(`Skipping markShipmentVerified for delivered/in-progress shipment ${shipment.trackingNumber}.`)
      }
    })
  }
}

interface MarkBillingAsRefundInput {
  isRefunded: boolean
  billingId: string
  paymentId: string

  reason?: string
  imageEvidenceId?: string
  paymentDate?: Date
  paymentTime?: Date
  amount?: number
}

export async function markBillingAsRefunded(input: MarkBillingAsRefundInput, adminId: string, session?: ClientSession) {
  const { billingId, paymentId, isRefunded, reason, imageEvidenceId, paymentDate, paymentTime, amount } = input
  const _billing = await BillingModel.findById(billingId).session(session)
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
      amount,
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
    const _refund = await RefundNoteModel.findById(_billing.refundNote).session(session)
    console.log('refund:: ', _refund, _billing.refundNote)
    if (_refund) {
      const _newTax = _refund.tax > 0 ? amount * (1 / (100 - 1)) : 0
      const _newSubTotal = amount + _newTax

      const _movemateTransaction = new TransactionModel({
        amountTax: _newTax,
        amountBeforeTax: _newSubTotal,
        amount,
        // amountBeforeTax: _payment.subTotal,
        // amount: _payment.total,
        ownerId: MOVEMATE_OWNER_ID,
        ownerType: ETransactionOwner.MOVEMATE,
        description: `คืนเงินหมายเลขใบแจ้งหนี้ ${_billing.billingNumber}`,
        refId: _billing._id,
        refType: ERefType.BILLING,
        transactionType: ETransactionType.OUTCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await _movemateTransaction.save({ session })

      // Refund:

      if (_refund.amountType === ERefundAmountType.FULL_AMOUNT) {
        /**
         * คืนเงิน 100%
         * ออกใบคืนเงินเต็มจำนวน
         * REFUND RECEIPT
         * nonTaxRefundReceipt
         * ลูกค้ายกเลิกการใช้บริการก่อนวันให้บริิการจริง คืนเงินเต็มจำนวนตามเงื่อนไขบริษัท
         */
        await _refund.updateOne(
          { refundDate: paymentDate, amount, subtotal: _newSubTotal, tax: _newTax, total: amount },
          { session },
        )
        const _newRefund = await RefundNoteModel.findById(_refund._id).session(session)
        const { document } = await generateRefundReceipt(_billing, _newRefund, session)
        await RefundNoteModel.findByIdAndUpdate(_refund._id, { document }, { session })
        /**
         * TODO: Send Email: ???
         */
      } else if (_refund.amountType === ERefundAmountType.HALF_AMOUNT) {
        /**
         * คืนเงิน 50%
         * ออกใบเสร็จคืนเงินบางส่วน
         * RECEIPT
         * generateNonTaxReceipt
         */
        const _receiptNumber = await generateMonthlySequenceNumber('receipt')
        const _advanceReceipt = _billing.advanceReceipt
        const _advanceReceiptNumber = _advanceReceipt?.receiptNumber || ''

        const _receipt = new ReceiptModel({
          receiptNumber: _receiptNumber,
          refReceiptNumber: _advanceReceiptNumber,
          receiptType: EReceiptType.FINAL,
          receiptDate: paymentDate,
          total: amount,
          subTotal: _newSubTotal,
          tax: _newTax,
          remarks: _refund.remark,
          updatedBy: adminId,
        })
        const { document } = await generateCashReceipt(_billing, _receipt, session)
        _receipt.document = document._id
        await _receipt.save({ session })
        await BillingModel.findByIdAndUpdate(
          _billing._id,
          { refundNote: null, $push: { receipts: _receipt._id } },
          { session },
        )
        await RefundNoteModel.findByIdAndDelete(_refund._id, { session })
        /**
         * TODO: Send Email: ???
         */
      }
    } else {
      const isBusiness = (_billing.user as User)?.userType === EUserType.BUSINESS
      const _newTax = isBusiness ? amount * (1 / (100 - 1)) : 0
      const _newSubTotal = amount + _newTax

      const _movemateTransaction = new TransactionModel({
        amountTax: _newTax,
        amountBeforeTax: _newSubTotal,
        amount,
        // amountBeforeTax: _payment.subTotal,
        // amount: _payment.total,
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

  const userId = get(_billing, 'user._id', '')
  const isCreditPayment = _billing.paymentMethod === EPaymentMethod.CREDIT
  if (isCreditPayment) {
    /**
     * Update customer balance
     */
    await addCustomerCreditUsage(userId, _payment.total, session)
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
    userId: userId,
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
  }).session(session)

  await BillingModel.findByIdAndUpdate(billingId, { status: EBillingStatus.VERIFY }, { session })
  return true
}

/**
 * Revert Rejected Payment
 * @param billingId
 * @param paymentId
 * @param adminId
 * @param session
 */
export async function revertPaymentRejection(
  billingId: string,
  paymentId: string,
  adminId: string,
  session?: ClientSession,
) {
  const _billing = await BillingModel.findById(billingId).session(session)
  const _payment = await PaymentModel.findById(paymentId).session(session)

  // 1. ตรวจสอบว่า Billing และ Payment อยู่ในสถานะที่สามารถย้อนกลับได้หรือไม่
  if (!_billing || !_payment) {
    throw new GraphQLError('ไม่พบข้อมูลใบแจ้งหนี้หรือการชำระเงิน')
  }

  if (_billing.state !== EBillingState.REFUND || _payment.type !== EPaymentType.REFUND) {
    throw new GraphQLError('สถานะปัจจุบันของรายการนี้ไม่สามารถย้อนกลับได้')
  }

  // 2. อัปเดตสถานะ Payment กลับไปเป็น "รอตรวจสอบ"
  await PaymentModel.findByIdAndUpdate(
    paymentId,
    {
      status: EPaymentStatus.VERIFY, // กลับไปเป็นสถานะรอตรวจสอบ
      type: EPaymentType.PAY, // กลับไปเป็นประเภท "จ่าย"
    },
    { session },
  )

  // 3. อัปเดตสถานะ Billing และจัดการ array 'reasons'
  const billingDoc = await BillingModel.findById(billingId).session(session)
  if (!billingDoc) {
    throw new GraphQLError('ไม่พบข้อมูลใบแจ้งหนี้ที่จะอัปเดต')
  }

  // กรองเอาเหตุผลที่ไม่ใช่ REJECTED_PAYMENT ออก
  const otherReasons = billingDoc.reasons.filter((r) => r.type !== EBillingReason.REJECTED_PAYMENT)

  // สร้างเหตุผลใหม่สำหรับการย้อนสถานะ
  const newReason: BillingReason = {
    detail: 'ย้อนกลับสถานะโดยผู้ดูแลระบบ',
    type: EBillingReason.REJECTED_PAYMENT, // หรืออาจจะใช้ Type ใหม่ถ้าต้องการแยกแยะ
  }

  await BillingModel.findByIdAndUpdate(
    billingId,
    {
      status: EBillingStatus.VERIFY,
      state: EBillingState.CURRENT,
      reasons: [...otherReasons, newReason],
    },
    { session },
  )

  // 4. ย้อนสถานะของ Shipment ทั้งหมดที่เกี่ยวข้อง
  await Aigle.forEach(_billing.shipments as Shipment[], async (shipment) => {
    await revertShipmentRejection(shipment._id, adminId, session)
  })
}
