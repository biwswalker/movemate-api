import {
  cancelShipmentQueue,
  ShipmentPayload,
  shipmentNotifyQueue,
  ShipmentNotifyPayload,
  askCustomerShipmentQueue,
  DeleteShipmentPayload,
} from '@configs/jobQueue'
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
import lodash, { filter, find, get, head, isEmpty, isEqual, last, map, sortBy, sum, tail } from 'lodash'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { decryption } from '@utils/encryption'
import { th } from 'date-fns/locale'
import { Message } from 'firebase-admin/messaging'
import { DoneCallback, Job } from 'bull'
import redis from '@configs/redis'
import { getNewAllAvailableShipmentForDriver } from './shipmentGet'

Aigle.mixin(lodash, {})

export async function shipmentNotify(shipmentId: string, driverId: string) {
  const LIMIT_3 = 3
  const LIMIT_6 = 6
  const LIMIT_12 = 12 // 0 - 110 min
  const FIVEMIN = 5 * 60_000
  const TENMIN = 10 * 60_000

  if (driverId) {
    // TODO: Recheck when noti working logic
    const driver = await UserModel.findOne({
      _id: driverId,
      userRole: EUserRole.DRIVER,
      drivingStatus: EDriverStatus.IDLE,
    }).lean()
    if (driver) {
      await shipmentNotifyQueue.add({ shipmentId, driverId, each: TENMIN, limit: LIMIT_3 })
      return
    }
  }
  await shipmentNotifyQueue.add({ shipmentId, each: TENMIN, limit: LIMIT_12 })
  await ShipmentModel.findByIdAndUpdate(shipmentId, { notificationCount: 1 })
  return
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
      varient: ENotificationVarient.WRANING,
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
        varient: ENotificationVarient.WRANING,
        title: 'การจองของท่านถูกยกเลิกอัตโนมัติ',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${shipment.trackingNumber} ระบบทำการยกเลิกอัตโนมัติเนื่องจากเลยระยะเวลาที่กำหนด`,
        ],

        infoText: 'ดูงานขนส่ง',
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      })
    }
  }

  const newShipments = await getNewAllAvailableShipmentForDriver()
  await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
  console.log(`Shipment ${shipmentId} is cancelled.`)
}

export const pauseShipmentNotify = async (shipmentId: string): Promise<boolean> => {
  const FIVTY_MIN = 15 * 60_000
  const shipment = await ShipmentModel.findById(shipmentId)
  await shipment.updateOne({ isNotificationPause: true, driver: undefined })
  await NotificationModel.sendNotification({
    varient: ENotificationVarient.WRANING,
    permanent: true,
    userId: get(shipment, 'customer._id', ''),
    title: 'การค้นหาคนขับได้หยุดชั่วคราว',
    message: [
      'ไม่มีพนักงานขนส่งรับงานหรือกำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่',
      'หากท่านจะใช้งานต่อโปรดดำเนินการในหน้า "ขนส่งของฉัน"',
    ],
    masterLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
    masterText: 'จัดการขนส่ง',
  })
  await cancelShipmentQueue.add(
    {
      shipmentId,
      type: 'idle_customer',
      message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีการกดดำเนินการในระยะเวลาที่กำหนด',
      reason: EShipmentCancellationReason.OTHER,
    },
    { delay: FIVTY_MIN },
  )

  return true
}

export const checkShipmentStatus = async (shipmentId: string): Promise<boolean> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  return shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING
}

export const sendNewShipmentNotification = async (
  shipmentId: string,
  requestDriverId: string,
): Promise<{ notify: boolean; driver: boolean }> => {
  const shipment = await ShipmentModel.findById(shipmentId)
  if (!shipment) {
    return { notify: false, driver: false }
  }

  if (shipment?.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING) {
    const currentTime = new Date().getTime()
    const createdTime = new Date(shipment.createdAt).getTime()

    // ถ้าผ่านไป 240 นาทีแล้วยังไม่มี driver รับงาน
    const coutingdownTime = currentTime - createdTime
    const LIMITIME = 190 * 60 * 1000
    if (coutingdownTime < LIMITIME) {
      // ส่ง FCM Notification
      if (requestDriverId) {
        // TODO: Recheck when noti working logic
        const driver = await UserModel.findOne({
          _id: shipment.requestedDriver,
          userRole: EUserRole.DRIVER,
          drivingStatus: EDriverStatus.IDLE,
        })
        if (
          driver &&
          driver.status === EUserStatus.ACTIVE &&
          driver.drivingStatus === EDriverStatus.IDLE &&
          driver.validationStatus === EUserValidationStatus.APPROVE
        ) {
          if (driver.fcmToken) {
            const token = decryption(driver.fcmToken)
            const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
            const vehicleText = get(shipment, 'vehicleId.name', '')
            const pickup = head(shipment.destinations)
            const pickupText = pickup.name
            const dropoffs = tail(shipment.destinations)
            const firstDropoff = head(dropoffs)
            const dropoffsText = `${firstDropoff.name}${dropoffs.length > 1 ? `และอีก ${dropoffs.length - 1} จุด` : ''}`
            const message = `🚛 งานใหม่! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`
            await NotificationModel.sendFCMNotification({
              token,
              data: {
                navigation: ENavigationType.SHIPMENT,
                trackingNumber: shipment.trackingNumber,
              },
              notification: { title: NOTIFICATION_TITLE, body: message },
            })
            return { notify: true, driver: true }
          }
        } else {
          await shipment.updateOne({ isNotificationPause: true })
          await NotificationModel.sendNotification({
            varient: ENotificationVarient.WRANING,
            permanent: true,
            userId: get(shipment, 'customer._id', ''),
            title: 'การค้นหาคนขับได้หยุดชั่วคราว',
            message: [
              'พนักงานขนส่งคนโปรด กำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่',
              'หากท่านจะใช้งานต่อโปรดดำเนินการในหน้า "ขนส่งของฉัน"',
            ],
            masterLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
            masterText: 'จัดการขนส่ง',
          })
          await cancelShipmentQueue.add(
            {
              shipmentId,
              type: 'idle_customer',
              message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีการกดดำเนินการในระยะเวลาที่กำหนด',
              reason: EShipmentCancellationReason.OTHER,
            },
            { delay: 15 * 60_000 },
          )
          return { notify: false, driver: false }
        }
      } else {
        // Other drivers
        const drivers = await UserModel.find({ userRole: EUserRole.DRIVER, drivingStatus: EDriverStatus.IDLE })
        const messages = map<User, Message>(
          filter(drivers, ({ fcmToken }) => !isEmpty(fcmToken)),
          (driver) => {
            if (
              driver &&
              driver.fcmToken &&
              driver.status === EUserStatus.ACTIVE &&
              driver.drivingStatus === EDriverStatus.IDLE &&
              driver.validationStatus === EUserValidationStatus.APPROVE
            ) {
              const token = decryption(driver.fcmToken)
              const dateText = format(shipment.bookingDateTime, 'dd MMM HH:mm', { locale: th })
              const vehicleText = get(shipment, 'vehicleId.name', '')
              const pickup = head(shipment.destinations)
              const pickupText = pickup.name
              const dropoffs = tail(shipment.destinations)
              const firstDropoff = head(dropoffs)
              const dropoffsText = `${firstDropoff.name}${
                dropoffs.length > 1 ? ` และอีก ${dropoffs.length - 1} จุด` : ''
              }`
              const message = `🚛 งานใหม่! ${dateText} ${vehicleText} 📦 ${pickupText} 📍 ${dropoffsText}`
              return {
                token,
                data: {
                  navigation: ENavigationType.SHIPMENT,
                  trackingNumber: shipment.trackingNumber,
                },
                notification: { title: NOTIFICATION_TITLE, body: message },
              }
            }
            return
          },
        )
        if (!isEmpty(messages)) {
          await NotificationModel.sendFCMNotification(messages)
        }
        return { notify: true, driver: false }
      }
    }
  }

  return { notify: false, driver: false }
}

shipmentNotifyQueue.process(async (job: Job<ShipmentNotifyPayload>, done: DoneCallback) => {
  const { shipmentId, driverId, each, limit } = job.data
  console.log('Shipment Notify queue: ', format(new Date(), 'HH:mm:ss'), job.data)
  const redisKey = `shipment:${shipmentId}`
  const newCount = await redis.incr(redisKey)
  if (newCount < limit) {
    const { notify, driver } = await sendNewShipmentNotification(shipmentId, driverId)
    if (notify) {
      await shipmentNotifyQueue.add({ shipmentId, ...(driver ? { driverId } : {}), limit, each }, { delay: each })
    } else {
      // Stop notify to customer now
      redis.set(redisKey, 0)
    }
    return done()
  } else if (newCount === limit) {
    // It Lastest trigger
    const shipmentModel = await ShipmentModel.findById(shipmentId)
    if (shipmentModel.notificationCount > 1) {
      // Cancelled this shipment
      console.log('Shipment Notify queue: Cancelled Shipment')
      await cancelShipmentQueue.add({ shipmentId }, { delay: each })
    }
    // Notifi to Customer for ask continue matching
    console.log('Shipment Notify queue: Ask Customer to Continue')
    await askCustomerShipmentQueue.add({ shipmentId }, { delay: each })
  }
  redis.set(redisKey, 0)
  return done()
})

askCustomerShipmentQueue.process(async (job: Job<ShipmentPayload>, done: DoneCallback) => {
  const { shipmentId } = job.data
  console.log('askCustomerShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
  await pauseShipmentNotify(shipmentId)
  done()
})

cancelShipmentQueue.process(async (job: Job<DeleteShipmentPayload>, done: DoneCallback) => {
  console.log('cancelShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
  const { shipmentId, type = 'uninterest', message, reason } = job.data
  if (type === 'idle_customer') {
    const shipment = await ShipmentModel.findById(shipmentId).lean()
    if (shipment.isNotificationPause) {
      await cancelShipmentIfNotInterested(shipmentId, message, reason)
    }
  } else {
    console.log('cancelShipmentQueue: ', format(new Date(), 'HH:mm:ss'), job.data)
    await cancelShipmentIfNotInterested(shipmentId)
  }
  done()
})
