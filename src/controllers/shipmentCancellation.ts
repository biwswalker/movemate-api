import { EBillingReason, EBillingState, EBillingStatus, EReceiptType, ERefundAmountType } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import BillingModel from '@models/finance/billing.model'
import { BillingReason } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'
import NotificationModel, { ENavigationType, ENotificationVarient } from '@models/notification.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
} from '@models/transaction.model'
import UserModel from '@models/user.model'
import { VehicleType } from '@models/vehicleType.model'
import { generateMonthlySequenceNumber, generateRandomNumberPattern, generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { differenceInMinutes, format } from 'date-fns'
import { GraphQLError } from 'graphql'
import lodash, { find, get, includes } from 'lodash'
import { ClientSession } from 'mongoose'
import { publishDriverMatchingShipment } from './shipmentGet'
import { EUserRole, EUserType } from '@enums/users'
import { getAdminMenuNotificationCount } from '@resolvers/notification.resolvers'
import { initialStepDefinition } from './steps'
import { clearShipmentJobQueues } from './shipmentJobQueue'
import { addCustomerCreditUsage } from './customer'
import RefundNoteModel from '@models/finance/refundNote.model'
import ReceiptModel, { Receipt } from '@models/finance/receipt.model'
import { generateAdvanceReceipt } from 'reports/advanceReceipt'
import { generateNonTaxReceipt } from 'reports/nonTaxReceipt'

Aigle.mixin(lodash, {})

// ฟังก์ชันคำนวณค่าปรับจากการยกเลิก (Refactored for clarity)
export function calculateCancellationFee(shipment: Shipment, isPaymentComplete: boolean) {
  const cancellationTime = new Date()
  const latestQuotation = lodash.last(lodash.sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined

  if (!latestQuotation) {
    throw new GraphQLError('ไม่พบข้อมูลใบเสนอราคา', {
      extensions: { code: REPONSE_NAME.NOT_FOUND },
    })
  }

  // คำนวณยอดที่ต้องชำระจริง (เผื่อกรณีมีการแก้ไขใบเสนอราคา)
  const { total: totalCost, acturePrice: acturePriceCost, subTotal: subTotalCost } = latestQuotation.cost
  const totalPayCost = lodash.sum([subTotalCost, -(isPaymentComplete ? 0 : acturePriceCost)])

  const { total: totalPrice, acturePrice, subTotal: subTotalPrice } = latestQuotation.price
  const totalPayPrice = lodash.sum([subTotalPrice, -(isPaymentComplete ? 0 : acturePrice)])

  const vehicle = shipment.vehicleId as VehicleType
  const timeDifferenceInMinutes = differenceInMinutes(shipment.bookingDateTime, cancellationTime)

  const pickupStep = find(shipment.steps, ['step', EStepDefinition.PICKUP]) as StepDefinition | undefined
  const isDonePickup = pickupStep && pickupStep.stepStatus === EStepStatus.DONE

  const isFourWheeler = lodash.isEqual(vehicle.type, '4W')
  const urgentCancellingTime = isFourWheeler ? 40 : 90
  const middleCancellingTime = isFourWheeler ? 120 : 180

  const isDriverNotAccepted =
    !shipment.driver &&
    includes(
      [EDriverAcceptanceStatus.IDLE, EDriverAcceptanceStatus.PENDING, EDriverAcceptanceStatus.UNINTERESTED],
      shipment.driverAcceptanceStatus,
    )

  if (isDriverNotAccepted) {
    // ไม่คิดค่าบริการ -> คืนเงิน 100%
    return {
      forDriver: 0,
      forCustomer: totalPayPrice,
      description: `ผู้ใช้ยกเลิกงานขนส่ง`,
      state: 'FULL_CUSTOMER_REFUND',
    }
  } else if (isDonePickup) {
    // คิดค่าบริการ 100% -> คืนเงิน 0%
    return {
      forDriver: totalPayCost,
      forCustomer: 0,
      description: `ผู้ใช้ยกเลิกงานขนส่งหลังรับสินค้าแล้ว`,
      state: 'FULL_CHARGE',
    }
  } else if (timeDifferenceInMinutes <= urgentCancellingTime) {
    // คิดค่าบริการ 100% -> คืนเงิน 0%
    return {
      forDriver: totalPayCost,
      forCustomer: 0,
      description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${urgentCancellingTime} นาที`,
      state: 'FULL_CHARGE',
    }
  } else if (timeDifferenceInMinutes > urgentCancellingTime && timeDifferenceInMinutes <= middleCancellingTime) {
    // คิดค่าบริการ 50% -> คืนเงิน 50%
    return {
      forDriver: totalPayCost * 0.5,
      forCustomer: totalPayPrice * 0.5,
      description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${middleCancellingTime} นาที`,
      state: 'HALF_CUSTOMER_REFUND',
    }
  } else {
    // ไม่คิดค่าบริการ -> คืนเงิน 100%
    return {
      forDriver: 0,
      forCustomer: totalPayPrice,
      description: `ผู้ใช้ยกเลิกงานขนส่ง`,
      state: 'FULL_CUSTOMER_REFUND',
    }
  }
}

interface CancelledShipmentInput {
  shipmentId: string
  reason: string
}

/**
 * CANCEL SHIPMENT PROCESS
 * @param input
 * @param userId
 * @param session
 */
export async function cancelledShipment(input: CancelledShipmentInput, userId: string, session?: ClientSession) {
  const { shipmentId, reason } = input
  const _shipment = await ShipmentModel.findOne({ _id: shipmentId }).session(session)
  if (!_shipment) {
    const message = 'ไม่สามารถหาข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  const latestQuotation = lodash.last(lodash.sortBy(_shipment.quotations, ['createdAt'])) as Quotation | undefined
  if (!latestQuotation) {
    throw new GraphQLError('ไม่พบข้อมูลใบเสนอราคา', { extensions: { code: REPONSE_NAME.NOT_FOUND } })
  }

  const isCredit = _shipment.paymentMethod === EPaymentMethod.CREDIT
  const _latestPayment = isCredit
    ? undefined
    : await PaymentModel.findOne({ quotations: { $in: [latestQuotation._id] } }).session(session)

  const isDriverAccepted = _shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.ACCEPTED && _shipment.driver
  const isCompletePayment = isCredit ? true : _latestPayment?.status === EPaymentStatus.COMPLETE

  const {
    forCustomer,
    forDriver,
    description,
    state: feeState,
  } = calculateCancellationFee(_shipment, isCompletePayment)

  // Update step definitions
  const currentStep = lodash.find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
  const lastStep = lodash.last(lodash.sortBy(_shipment.steps, ['seq'])) as StepDefinition

  const deniedSteps = lodash.filter(_shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
  await Aigle.forEach(deniedSteps, async (step) => {
    await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED }, { session })
  })

  /**
   * New Step
   */
  const cancellationTime = new Date()
  let stepIds = []
  let _newLatestSeq = lastStep.seq + 1
  const _customerCancelledStep = new StepDefinitionModel({
    step: EStepDefinition.CUSTOMER_CANCELLED,
    seq: _newLatestSeq,
    stepName: EStepDefinitionName.CUSTOMER_CANCELLED,
    customerMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
    driverMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
    stepStatus: EStepStatus.DONE,
  })
  await _customerCancelledStep.save({ session })
  stepIds.push(_customerCancelledStep._id)

  let finalShipmentStatus = EShipmentStatus.CANCELLED

  if (!isCredit) {
    const _billing = await BillingModel.findOne({ billingNumber: _shipment.trackingNumber }).session(session)
    if (!_billing) {
      throw new GraphQLError('ไม่พบข้อมูลการเรียกเก็บเงินสำหรับงานขนส่งนี้', {
        extensions: { code: REPONSE_NAME.NOT_FOUND },
      })
    }

    if (forCustomer > 0) {
      // **[Corrected Logic]** Only enter refund flow if there is an amount to refund.
      finalShipmentStatus = EShipmentStatus.REFUND
      // Add refund step
      _newLatestSeq++
      const refundStep = new StepDefinitionModel({
        step: EStepDefinition.REFUND,
        seq: _newLatestSeq,
        stepName: EStepDefinitionName.REFUND,
        customerMessage: EStepDefinitionName.REFUND,
        driverMessage: EStepDefinitionName.REFUND,
        stepStatus: EStepStatus.PROGRESSING,
      })
      await refundStep.save({ session })
      stepIds.push(refundStep._id)

      // Create a refund payment record
      let whtAmount = 0
      // หักภาษี ณ ที่จ่าย 1% สำหรับลูกค้าธุรกิจที่มียอดเกิน 1,000 บาท
      const customerType = lodash.get(_shipment, 'customer.userType', '')
      if (customerType === EUserType.BUSINESS) {
        whtAmount = forCustomer * 0.01
      }
      const finalTotalAmount = forCustomer - whtAmount
      const generateMonth = format(cancellationTime, 'yyMM')
      const _paymentNumber = await generateTrackingNumber(`PREFU${generateMonth}`, 'payment', 3)
      const _refund = new PaymentModel({
        quotations: [latestQuotation?._id],
        paymentMethod: EPaymentMethod.CASH,
        paymentNumber: _paymentNumber,
        status: EPaymentStatus.PENDING,
        type: EPaymentType.REFUND,
        tax: whtAmount,
        total: finalTotalAmount,
        subTotal: forCustomer,
      })
      await _refund.save({ session })

      let refundNoteId = undefined
      if (feeState === 'FULL_CUSTOMER_REFUND') {
        /**
         * คืนเงิน 100%
         * ออกใบคืนเงินเต็มจำนวน
         * REFUND RECEIPT
         * nonTaxRefundReceipt
         * ลูกค้ายกเลิกการใช้บริการก่อนวันให้บริิการจริง คืนเงินเต็มจำนวนตามเงื่อนไขบริษัท
         */
        const _refundNoteNumber = await generateMonthlySequenceNumber('refundnote')
        const _advanceReceipt = _billing.advanceReceipt
        const _advanceReceiptNumber = _advanceReceipt?.receiptNumber || ''
        const _refundNote = new RefundNoteModel({
          refundNoteNumber: _refundNoteNumber,
          refAdvanceReceiptNo: _advanceReceiptNumber,
          billing: _billing._id,
          amount: forCustomer,
          amountType: ERefundAmountType.FULL_AMOUNT,
          remark: 'ลูกค้ายกเลิกการใช้บริการก่อนวันให้บริิการจริง คืนเงินเต็มจำนวนตามเงื่อนไขบริษัท',
        })
        await _refundNote.save({ session })
        refundNoteId = _refundNote._id
      } else if (feeState === 'HALF_CUSTOMER_REFUND') {
        /**
         * คืนเงิน 50%
         * ออกใบเสร็จคืนเงินบางส่วน
         * RECEIPT
         * generateNonTaxReceipt
         */
        // Make dummy
        const _refundNoteNumber = generateRandomNumberPattern(`DUMMYREFUNDNOTE####`)
        const _advanceReceipt = _billing.advanceReceipt
        const _advanceReceiptNumber = _advanceReceipt?.receiptNumber || ''
        const _refundNote = new RefundNoteModel({
          refundNoteNumber: _refundNoteNumber,
          refAdvanceReceiptNo: _advanceReceiptNumber,
          billing: _billing._id,
          amount: forCustomer,
          amountType: ERefundAmountType.HALF_AMOUNT,
          remark: 'ลูกค้ายกเลิกบริการใช้บริการ คืนเงินบางส่วนจากยอดชำระล่วงหน้าตามเงื่อนไขบริษัท',
        })
        await _refundNote.save({ session })
        refundNoteId = _refundNote._id
      }

      // Update billing to REFUND state
      const refundReason: BillingReason = {
        detail: description,
        type: EBillingReason.CANCELLED_SHIPMENT,
      }
      await BillingModel.findOneAndUpdate(
        { billingNumber: _shipment.trackingNumber },
        {
          status: EBillingStatus.PENDING,
          state: EBillingState.REFUND,
          ...(refundNoteId ? { refundNote: refundNoteId } : {}),
          $push: { payments: _refund, reasons: refundReason },
        },
      )
    } else {
      /**
       * คิดค่าบริการ 100% -> คืนเงิน 0%
       * ออกใบเสร็จ
       * generateNonTaxReceipt
       */
      const _receiptNumber = await generateMonthlySequenceNumber('receipt')
      const _advanceReceipt = _billing.advanceReceipt
      const _advanceReceiptNumber = _advanceReceipt?.receiptNumber || ''
      const _receipt = new ReceiptModel({
        receiptNumber: _receiptNumber,
        refReceiptNumber: _advanceReceiptNumber,
        receiptType: EReceiptType.FINAL,
        receiptDate: cancellationTime,
        total: _advanceReceipt?.total || 0,
        subTotal: _advanceReceipt?.subTotal || 0,
        tax: _advanceReceipt?.tax || 0,
        remarks: `ลูกค้ายกเลิกการใช้บริการ`,
        updatedBy: userId,
      })
      const { document } = await generateNonTaxReceipt(_billing, _receipt, session)
      _receipt.document = document._id
      await _receipt.save({ session })
      // Sent Email????

      // **[Corrected Logic]** No refund, so just cancel the billing.
      await BillingModel.findOneAndUpdate(
        { billingNumber: _shipment.trackingNumber },
        {
          status: EBillingStatus.CANCELLED,
          state: EBillingState.CURRENT, // Or other appropriate state
          $push: { receipts: _receipt },
        },
      )
    }

    // If latest payment was not completed, cancel it
    if (!isCompletePayment && _latestPayment) {
      await PaymentModel.findByIdAndUpdate(_latestPayment._id, { status: EPaymentStatus.CANCELLED }, { session })
    }
  } else {
    // Credit logic
    if (forCustomer > 0) {
      // ใช้ addCustomerCreditUsage โดยส่งค่าเป็นลบ เพื่อลด Credit Usage ลง
      await addCustomerCreditUsage(lodash.get(_shipment, 'customer._id', ''), -forCustomer, session)
    }
  }

  const customerCancellationFee = latestQuotation.price.subTotal - forCustomer

  // Update Shipment final status
  await ShipmentModel.findByIdAndUpdate(
    _shipment._id,
    {
      status: finalShipmentStatus, // Use the determined status
      cancellationReason: reason,
      cancelledDate: cancellationTime,
      cancellationFee: customerCancellationFee,
      cancellationBy: userId,
      currentStepSeq: _newLatestSeq,
      $push: { steps: { $each: stepIds } },
    },
    { session },
  )

  const updatedBy = await UserModel.findById(userId)
  const isCancelledByAdmin = updatedBy.userRole === EUserRole.ADMIN

  // Add driver's transaction if they had accepted the job
  if (isDriverAccepted && _shipment.driver && forDriver > 0) {
    const driverId = lodash.get(_shipment, 'driver._id', '')
    const driverSubtotal = forDriver
    const driverTax = driverSubtotal * 0.01
    const driverTotal = lodash.sum([driverSubtotal, -driverTax])

    // ตรวจสอบ transaction จากการยกเลิกงานที่มีอยู่แล้ว
    const existingCancelTransaction = await TransactionModel.findOne({
      amountTax: driverTax, // WHT
      amountBeforeTax: driverSubtotal,
      amount: driverTotal,
      ownerId: driverId,
      ownerType: ETransactionOwner.DRIVER,
      description: `ค่าชดเชยงาน #${_shipment.trackingNumber} ${description}`,
      refId: _shipment._id,
      refType: ERefType.SHIPMENT,
    }).session(session)

    if (existingCancelTransaction) {
      console.warn(
        `[cancelledShipment] Cancellation transaction for shipment ${_shipment._id} already exists. Skipping creation.`,
      )
    } else {
      const driverTransaction = new TransactionModel({
        amountTax: driverTax, // WHT
        amountBeforeTax: driverSubtotal,
        amount: driverTotal,
        ownerId: driverId,
        ownerType: ETransactionOwner.DRIVER,
        description: `ค่าชดเชยงาน #${_shipment.trackingNumber} ${description}`,
        refId: _shipment._id,
        refType: ERefType.SHIPMENT,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.PENDING,
      })
      await driverTransaction.save({ session })
    }

    // Driver Notification
    await NotificationModel.sendNotification(
      {
        userId: driverId,
        varient: ENotificationVarient.ERROR,
        title: 'งานขนส่งของท่านถูกยกเลิก',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${_shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดย${
            isCancelledByAdmin ? 'ผู้ดูแลระบบ' : 'ลูกค้า'
          } เหตุผล: ${reason}`,
          `กรุณาตรวจสอบรายละเอียดงานขนส่งของท่าน`,
        ],
      },
      session,
      true,
      { navigation: ENavigationType.SHIPMENT, trackingNumber: _shipment.trackingNumber },
    )
  }

  await NotificationModel.sendNotification(
    {
      userId: lodash.get(_shipment, 'customer._id', ''),
      varient: ENotificationVarient.ERROR,
      title: 'การจองของท่านถูกยกเลิกแล้ว',
      message: [
        `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${_shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดย${
          isCancelledByAdmin ? 'ผู้ดูแลระบบ' : 'ท่านเอง'
        }`,
        ...(!isCredit ? ['ระบบกำลังคำนวนยอดคืนเงิน และจะดำเนินการคืนให้ท่านในไม่ช้า'] : []),
      ],
      infoText: 'ดูงานขนส่ง',
      infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
    },
    session,
  )

  await NotificationModel.sendNotificationToAdmins(
    {
      varient: ENotificationVarient.ERROR,
      title: 'งานขนส่งถูกยกเลิก',
      message: [
        `การจองหมายเลข ${_shipment.trackingNumber} ถูกยกเลิกโดย ${
          isCancelledByAdmin ? updatedBy.fullname : 'ลูกค้า'
        } เหตุผล: ${reason}`,
      ],
    },
    session,
  )

  // Trigger notification badge for Admin
  await getAdminMenuNotificationCount(session)
  // Trigger shipment list for Driver
  await publishDriverMatchingShipment(undefined, undefined, session)

  console.log(`Shipment ${shipmentId} is cancelled.`)
}

interface CancelledShipmentInput {
  shipmentId: string
  reason: string
}

export async function driverCancelledShipment(
  input: CancelledShipmentInput,
  driverId: string,
  session?: ClientSession,
) {
  const { shipmentId, reason } = input
  const cancellationTime = new Date()

  const shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!shipment) {
    throw new GraphQLError('ไม่สามารถหาข้อมูลงานขนส่งได้', { extensions: { code: REPONSE_NAME.NOT_FOUND } })
  }

  // เงื่อนไขที่ 1: ตรวจสอบว่ายกเลิกก่อนเริ่มงานเกิน 180 นาทีหรือไม่
  const minutesToBooking = differenceInMinutes(shipment.bookingDateTime, cancellationTime)
  if (minutesToBooking <= 180) {
    throw new GraphQLError('ไม่สามารถยกเลิกงานได้ เนื่องจากเหลือเวลาน้อยกว่า 180 นาทีก่อนเริ่มงาน', {
      extensions: { code: REPONSE_NAME.BAD_REQUEST },
    })
  }

  // เงื่อนไขที่ 2: ตรวจสอบว่างานยังไม่เริ่ม (ก่อนขั้นตอน CONFIRM_DATETIME)
  const confirmDateTimeStep = find(shipment.steps, ['step', EStepDefinition.CONFIRM_DATETIME]) as
    | StepDefinition
    | undefined
  if (confirmDateTimeStep && shipment.currentStepSeq > confirmDateTimeStep.seq) {
    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    throw new GraphQLError(`ไม่สามารถยกเลิกงานในขั้นตอนปัจจุบันได้ (${currentStep?.stepName})`, {
      extensions: { code: REPONSE_NAME.BAD_REQUEST },
    })
  }

  // Clear notification queue
  await clearShipmentJobQueues(shipmentId)

  // Update shipment
  const _shipment = await ShipmentModel.findByIdAndUpdate(
    shipmentId,
    {
      $unset: { driver: 1, agentDriver: 1 }, // ลบข้อมูลคนขับเดิมออก
      status: EShipmentStatus.IDLE,
      driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
      cancellationReason: reason,
      cancelledDate: cancellationTime,
      currentStepSeq: 0,
      cancellationBy: driverId,
      steps: [],
    },
    { session },
  )
  await initialStepDefinition(shipmentId, true, session)

  const _driver = await UserModel.findById(driverId).session(session)

  await NotificationModel.sendNotificationToAdmins(
    {
      varient: ENotificationVarient.WRANING,
      title: 'คนขับยกเลิกงาน!',
      message: [
        `คนขับ ${_driver.fullname} (${_driver.userNumber}) ได้ยกเลิกงานขนส่งหมายเลข '${_shipment.trackingNumber}' กรุณาจัดหาคนขับใหม่หรือดำเนินการแก้ไข`,
      ],
      infoText: 'ดูรายละเอียดงาน',
      infoLink: `/general/shipments/${_shipment.trackingNumber}`,
    },
    session,
  )

  const customerId = get(_shipment, 'customer._id', '')
  await NotificationModel.sendNotification(
    {
      userId: customerId,
      varient: ENotificationVarient.WRANING,
      title: 'คนขับยกเลิกการจัดส่ง',
      message: [
        `งานขนส่งหมายเลข ${_shipment.trackingNumber} ของคุณถูกยกเลิกโดยคนขับ ${_driver.fullname} (${_driver.userNumber})`,
        `ระบบกำลังจัดหาคนขับใหม่ให้คุณ`,
      ],
    },
    session,
  )

  await publishDriverMatchingShipment(undefined, undefined, session)
}
