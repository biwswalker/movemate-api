import { cancelShipmentQueue, shipmentNotifyQueue } from '@configs/jobQueue'
import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EDriverAcceptanceStatus, EShipmentCancellationReason, EShipmentStatus } from '@enums/shipments'
import { EDriverStatus, EUserRole, EUserStatus, EUserValidationStatus } from '@enums/users'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from '@models/customerBusinessCreditPayment.model'
import BillingModel from '@models/finance/billing.model'
import { BillingReason } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'
import NotificationModel, {
  ENavigationType,
  ENotificationVarient,
  NOTIFICATION_TITLE,
} from '@models/notification.model'
import ShipmentModel from '@models/shipment.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import UserModel, { User } from '@models/user.model'
import { fCurrency } from '@utils/formatNumber'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { format } from 'date-fns'
import { GraphQLError } from 'graphql'
import lodash, { filter, find, get, head, includes, isEmpty, isEqual, last, sortBy, sum, tail } from 'lodash'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { decryption } from '@utils/encryption'
import { th } from 'date-fns/locale'
import { Message } from 'firebase-admin/messaging'
import { publishDriverMatchingShipment } from './shipmentGet'
import DriverDetailModel from '@models/driverDetail.model'
import { isDriverAvailableForShipment } from './driver'

Aigle.mixin(lodash, {})

export async function shipmentNotify(shipmentId: string) {
  const shipment = await ShipmentModel.findById(shipmentId).lean()
  console.log('Start shipment notify: ', shipmentId, shipment)
  if (!shipment) return

  // ตรวจสอบสถานะเบื้องต้น
  console.log('Shipment driver accepted currnet status: ', shipment.driverAcceptanceStatus)
  if (!includes([EDriverAcceptanceStatus.IDLE, EDriverAcceptanceStatus.PENDING], shipment.driverAcceptanceStatus)) {
    console.log(`Shipment ${shipmentId} is already accepted or cancelled. No notification sent.`)
    return
  }

  const requestedDriverStringId = shipment.requestedDriver ? shipment.requestedDriver.toString() : ''

  // Sent Socket to driver
  console.log(`[Subscription] Trigger get shipment: (${shipmentId}) to driver: (${requestedDriverStringId})`)
  await publishDriverMatchingShipment(requestedDriverStringId)

  // If Requested driver
  if (requestedDriverStringId) {
    // กรณีที่ 2: เลือกคนขับคนโปรด
    const favoriteDriver = await UserModel.findById(requestedDriverStringId).lean()

    // ตรวจสอบว่าคนขับว่างหรือไม่
    const isAvailable = await isDriverAvailableForShipment(requestedDriverStringId, shipment)

    if (favoriteDriver && isAvailable) {
      console.log(`[Notify] Starting FAVORITE_DRIVER stage for shipment ${shipmentId}`)
      await shipmentNotifyQueue.add({
        shipmentId,
        driverId: requestedDriverStringId,
        stage: 'FAVORITE_DRIVER',
        iteration: 1,
      })
      return
    }
    // หากคนขับไม่ว่าง ให้แจ้งลูกค้า (อาจจะผ่าน notification อีกแบบ)
    // แล้วอาจจะเริ่ม INITIAL_BROADCAST
    // ...
  }

  // กรณีที่ 1: ไม่ได้เลือกคนขับคนโปรด (General Broadcast)
  console.log(`[Notify] Starting INITIAL_BROADCAST stage for shipment ${shipmentId}`)
  await ShipmentModel.findByIdAndUpdate(shipmentId, { notificationCount: 1 }) // ใช้ notificationCount เพื่อติดตาม stage
  await shipmentNotifyQueue.add({
    shipmentId,
    stage: 'INITIAL_BROADCAST',
    iteration: 1,
  })
}

export const cancelShipmentIfNotInterested = async (
  shipmentId: string,
  cancelMessage: string = EStepDefinitionName.UNINTERESTED_DRIVER,
  cancelReason: string = EStepDefinitionName.UNINTERESTED_DRIVER,
) => {
  const shipment = await ShipmentModel.findById(shipmentId)
  const paymentMethod = shipment.paymentMethod

  if (!shipment) return
  if (shipment?.driverAcceptanceStatus !== EDriverAcceptanceStatus.PENDING) return
  const latestQuotation = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined

  // Make refund if Cash
  if (isEqual(paymentMethod, EPaymentMethod.CASH)) {
    const billing = await BillingModel.findOne({ billingNumber: shipment.trackingNumber }).lean()
    if (!billing) {
      const message = 'พบปัญหาทางเทคนิค'
      throw new GraphQLError(message, {
        extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] },
      })
    }
    const generateMonth = format(new Date(), 'yyMM')
    const _paymentNumber = await generateTrackingNumber(`PREFU${generateMonth}`, 'payment', 3)
    const _refund = new PaymentModel({
      quotations: [latestQuotation?._id],
      paymentMethod: EPaymentMethod.CASH,
      paymentNumber: _paymentNumber,
      status: EPaymentStatus.PENDING,
      type: EPaymentType.REFUND,
      tax: latestQuotation.price.tax,
      total: latestQuotation.price.total,
      subTotal: latestQuotation.price.subTotal,
    })
    await _refund.save()

    const refundReason: BillingReason = {
      detail: `ไม่มีคนขับรับงาน ยอดที่ต้องคืน ${fCurrency(Math.abs(latestQuotation.price.total))} บาท`,
      type: EBillingReason.CANCELLED_SHIPMENT,
    }

    await BillingModel.findByIdAndUpdate(billing._id, {
      state: EBillingState.REFUND,
      status: EBillingStatus.PENDING,
      $push: {
        payments: _refund._id,
        reasons: refundReason,
      },
    })

    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(shipment.steps) as StepDefinition
    if (currentStep) {
      const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
      await Aigle.forEach(deniedSteps, async (step) => {
        const isWaitDriverStep = step.step === EStepDefinition.DRIVER_ACCEPTED && step.seq === currentStep.seq
        const waitDriverStepChangeData = isWaitDriverStep
          ? {
              step: EStepDefinition.UNINTERESTED_DRIVER,
              stepName: EStepDefinitionName.UNINTERESTED_DRIVER,
              customerMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
              driverMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
            }
          : {}
        await StepDefinitionModel.findByIdAndUpdate(step._id, {
          stepStatus: EStepStatus.CANCELLED,
          ...waitDriverStepChangeData,
        })
      })
      // Add system cancelled step
      const systemCancelledSeq = lastStep.seq + 1
      const systemCancelledStep = new StepDefinitionModel({
        step: EStepDefinition.SYSTEM_CANCELLED,
        seq: systemCancelledSeq,
        stepName: EStepDefinitionName.SYSTEM_CANCELLED,
        customerMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        driverMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        stepStatus: EStepStatus.DONE,
      })
      await systemCancelledStep.save()
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

      // Update Shipment
      await shipment.updateOne({
        status: EShipmentStatus.REFUND,
        driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
        cancellationReason: cancelReason,
        cancellationDetail: cancelMessage,
        cancelledDate: new Date().toISOString(),
        currentStepSeq: newLatestSeq,
        $push: { steps: refundStep._id },
      })
    }

    await NotificationModel.sendNotification({
      userId: get(shipment, 'customer._id', ''),
      varient: ENotificationVarient.ERROR,
      title: 'การจองของท่านถูกยกเลิกอัตโนมัติ',
      message: [
        `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ระบบทำการยกเลิกอัตโนมัติเนื่องจากเลยระยะเวลาที่กำหนด และจะดำเนินการคืนให้ท่านในไม่ช้า`,
      ],
      infoText: 'ดูงานขนส่ง',
      infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
    })
  } else {
    const currentStep = find(shipment.steps, ['seq', shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(shipment.steps) as StepDefinition
    if (currentStep) {
      // Update Shipment
      const deniedSteps = filter(shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
      await Aigle.forEach(deniedSteps, async (step) => {
        const isWaitDriverStep = step.step === EStepDefinition.DRIVER_ACCEPTED && step.seq === currentStep.seq
        const waitDriverStepChangeData = isWaitDriverStep
          ? {
              step: EStepDefinition.UNINTERESTED_DRIVER,
              stepName: EStepDefinitionName.UNINTERESTED_DRIVER,
              customerMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
              driverMessage: EStepDefinitionName.UNINTERESTED_DRIVER,
            }
          : {}
        await StepDefinitionModel.findByIdAndUpdate(step._id, {
          stepStatus: EStepStatus.CANCELLED,
          ...waitDriverStepChangeData,
        })
      })
      // Add system cancelled step
      const systemCancelledSeq = lastStep.seq + 1
      const systemCancelledStep = new StepDefinitionModel({
        step: EStepDefinition.SYSTEM_CANCELLED,
        seq: systemCancelledSeq,
        stepName: EStepDefinitionName.SYSTEM_CANCELLED,
        customerMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        driverMessage: EStepDefinitionName.SYSTEM_CANCELLED,
        stepStatus: EStepStatus.DONE,
      })
      await systemCancelledStep.save()

      await shipment.updateOne({
        status: EShipmentStatus.CANCELLED,
        driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
        cancellationReason: cancelReason,
        cancellationDetail: cancelMessage,
        cancelledDate: new Date().toISOString(),
        currentStepSeq: systemCancelledSeq,
        $push: { steps: systemCancelledStep._id },
      })

      const total = latestQuotation.price.total
      const user = await UserModel.findById(shipment.customer)
      const creditDetail = get(user, 'businessDetail.creditPayment', undefined) as
        | BusinessCustomerCreditPayment
        | undefined
      if (creditDetail) {
        const newCreditBalance = sum([creditDetail.creditUsage, -total])
        await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(creditDetail._id, {
          creditUsage: newCreditBalance,
        })
      }

      await NotificationModel.sendNotification({
        userId: get(shipment, 'customer._id', ''),
        varient: ENotificationVarient.ERROR,
        title: 'การจองของท่านถูกยกเลิกอัตโนมัติ',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ระบบทำการยกเลิกอัตโนมัติเนื่องจากเลยระยะเวลาที่กำหนด`,
        ],

        infoText: 'ดูงานขนส่ง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
    }
  }

  await NotificationModel.sendNotificationToAdmins({
    varient: ENotificationVarient.ERROR,
    title: 'ยกเลิกงานอัตโนมัติ: ไม่มีคนขับ',
    message: [`ระบบได้ยกเลิกงานขนส่งหมายเลข '${shipment.trackingNumber}' เนื่องจากไม่มีคนขับรับงานภายในเวลาที่กำหนด`],
    infoText: 'ดูรายละเอียดงาน',
    infoLink: `/general/shipments/${shipment.trackingNumber}`,
  })

  await publishDriverMatchingShipment()
  console.log(`Shipment ${shipmentId} is cancelled.`)
}

const CUSTOMER_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 นาที

// ฟังก์ชันสำหรับหยุดการแจ้งเตือนและถามลูกค้า
export const pauseShipmentNotify = async (shipmentId: string, customerMessage: string): Promise<boolean> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  if (!shipment || shipment.driverAcceptanceStatus !== EDriverAcceptanceStatus.PENDING) {
    return false
  }

  await shipment.updateOne({ isNotificationPause: true })

  await NotificationModel.sendNotification({
    varient: ENotificationVarient.WRANING,
    permanent: true,
    userId: get(shipment, 'customer._id', ''),
    title: 'การค้นหาคนขับหยุดชั่วคราว',
    message: [customerMessage],
    masterLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`, // หรือหน้าที่ลูกค้าสามารถกด "ค้นหาต่อ"
    masterText: 'จัดการขนส่ง',
  })

  // ตั้งเวลา 30 นาทีเพื่อยกเลิกงานหากลูกค้าไม่ตอบสนอง
  await cancelShipmentQueue.add(
    {
      shipmentId,
      type: 'idle_customer',
      message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีการกดดำเนินการในระยะเวลาที่กำหนด',
      reason: EShipmentCancellationReason.OTHER,
    },
    { delay: CUSTOMER_IDLE_TIMEOUT },
  )

  return true
}

export const checkShipmentStatus = async (shipmentId: string): Promise<boolean> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  return shipment?.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING
}

export const sendNewShipmentNotification = async (shipmentId: string, requestDriverId?: string): Promise<void> => {
  const shipment = await ShipmentModel.findById(shipmentId).populate('vehicleId').lean()

  if (!shipment) {
    console.error(`[FCM] Shipment ${shipmentId} not found.`)
    return
  }

  // Logic การสร้างข้อความยังคงเดิม
  const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
  const vehicleText = get(shipment, 'vehicleId.name', '')
  const pickup = head(shipment.destinations)
  const pickupText = pickup.name
  const dropoffs = tail(shipment.destinations)
  const firstDropoff = head(dropoffs)
  const dropoffsText = `${firstDropoff.name}${dropoffs.length > 1 ? ` และอีก ${dropoffs.length - 1} จุด` : ''}`
  const messageBody = `🚛 งานใหม่! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`

  const fcmPayload = {
    data: {
      navigation: ENavigationType.SHIPMENT,
      trackingNumber: shipment.trackingNumber,
    },
    notification: { title: NOTIFICATION_TITLE, body: messageBody },
  }

  // ส่ง FCM Notification
  if (requestDriverId) {
    // กรณีเจาะจงคนขับคนโปรด
    const driver = await UserModel.findOne({
      _id: requestDriverId,
      userRole: EUserRole.DRIVER,
      status: EUserStatus.ACTIVE,
      drivingStatus: EDriverStatus.IDLE,
      validationStatus: EUserValidationStatus.APPROVE,
    }).lean()

    if (driver && driver.fcmToken) {
      const token = decryption(driver.fcmToken)
      console.log(`[FCM] Sending to favorite driver ${driver.userNumber} for shipment ${shipment.trackingNumber}`)
      await NotificationModel.sendFCMNotification({ ...fcmPayload, token })
    } else {
      console.log(`[FCM] Favorite driver ${requestDriverId} not available or no FCM token.`)
    }
  } else {
    // 1. ดึง ID ของประเภทรถจากงาน (Shipment)
    const vehicleTypeId = get(shipment, 'vehicleId._id')
    if (!vehicleTypeId) {
      console.error(`[FCM] Cannot find vehicleTypeId for shipment ${shipment.trackingNumber}`)
      return
    }

    // 2. ค้นหา DriverDetail IDs ทั้งหมดที่ให้บริการรถประเภทนี้
    const matchingDriverDetails = await DriverDetailModel.find({
      serviceVehicleTypes: vehicleTypeId,
    })
      .select('_id')
      .lean()

    const matchingDriverDetailIds = matchingDriverDetails.map((d) => d._id)

    if (isEmpty(matchingDriverDetailIds)) {
      console.log(`[FCM] No drivers found for vehicle type ${vehicleTypeId}`)
      return
    }

    // 3. ค้นหา User (คนขับ) ที่พร้อมใช้งานและมี driverDetail ตรงกับที่เราหามา
    const availableDrivers = await UserModel.find({
      userRole: EUserRole.DRIVER,
      status: EUserStatus.ACTIVE,
      drivingStatus: { $in: [EDriverStatus.IDLE, EDriverStatus.WORKING] },
      validationStatus: EUserValidationStatus.APPROVE,
      fcmToken: { $exists: true, $nin: [null, ''] }, // กรองคนที่มี Token เท่านั้น
      driverDetail: { $in: matchingDriverDetailIds },
    }).lean()

    // 4. สร้าง FCM messages จากรายชื่อคนขับที่ถูกต้อง
    const messages: Message[] = availableDrivers.map((driver) => {
      const token = decryption(driver.fcmToken)
      return { ...fcmPayload, token }
    })

    if (!isEmpty(messages)) {
      console.log(`[FCM] Broadcasting to ${messages.length} drivers for shipment ${shipment.trackingNumber}`)
      await NotificationModel.sendFCMNotification(messages)
    }
  }
}
