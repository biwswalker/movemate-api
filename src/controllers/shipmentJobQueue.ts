import {
  cancelShipmentQueue,
  DeleteShipmentPayload,
  ShipmentNotifyPayload,
  shipmentNotifyQueue,
} from '@configs/jobQueue'
import { DoneCallback, Job } from 'bull'
import {
  cancelShipmentIfNotInterested,
  checkShipmentStatus,
  pauseShipmentNotify,
  sendNewShipmentNotification,
} from './shipmentNotification'
import { EShipmentCancellationReason } from '@enums/shipments'
import { format } from 'date-fns'
import ShipmentModel from '@models/shipment.model'

// Constants สำหรับแต่ละ stage
const MIN = 60 * 1000
const FAVORITE_DRIVER_CONFIG = {
  limit: 3,
  each: 10 * MIN, // 10 นาที
}
const INITIAL_BROADCAST_CONFIG = {
  limit: 12,
  each: 10 * MIN, // 10 นาที
}
const SECOND_BROADCAST_CONFIG = {
  limit: 6,
  each: 5 * MIN, // 5 นาที
}

export default function initializeShipmentJob() {
  shipmentNotifyQueue.process(async (job: Job<ShipmentNotifyPayload>, done: DoneCallback) => {
    const { shipmentId, driverId, stage, iteration } = job.data
    console.log(`[Worker] Processing job for shipment ${shipmentId}, stage: ${stage}, iteration: ${iteration}`)

    const isShipmentStillPending = await checkShipmentStatus(shipmentId)
    if (!isShipmentStillPending) {
      console.log(`[Worker] Shipment ${shipmentId} is no longer pending. Stopping job.`)
      return done()
    }

    // ส่ง Notification
    await sendNewShipmentNotification(shipmentId, driverId)

    // ตรวจสอบเงื่อนไขของแต่ละ Stage
    switch (stage) {
      case 'FAVORITE_DRIVER':
        if (iteration < FAVORITE_DRIVER_CONFIG.limit) {
          // ส่ง job ต่อไปใน stage เดิม
          await shipmentNotifyQueue.add(
            { ...job.data, iteration: iteration + 1 },
            { delay: FAVORITE_DRIVER_CONFIG.each },
          )
        } else {
          // ครบ 3 ครั้งแล้ว, แจ้งเตือนลูกค้า
          await pauseShipmentNotify(shipmentId, 'คนขับคนโปรดไม่ตอบรับการขนส่ง ท่านต้องการค้นหาคนขับทั้งหมดหรือไม่?')
        }
        break

      case 'INITIAL_BROADCAST':
        if (iteration < INITIAL_BROADCAST_CONFIG.limit) {
          await shipmentNotifyQueue.add(
            { ...job.data, iteration: iteration + 1 },
            { delay: INITIAL_BROADCAST_CONFIG.each },
          )
        } else {
          // ครบ 120 นาที, แจ้งเตือนลูกค้า
          await pauseShipmentNotify(shipmentId, 'ยังไม่มีคนขับรับงานขนส่ง ท่านต้องการค้นหาต่อหรือไม่?')
        }
        break

      case 'SECOND_BROADCAST':
        if (iteration < SECOND_BROADCAST_CONFIG.limit) {
          await shipmentNotifyQueue.add(
            { ...job.data, iteration: iteration + 1 },
            { delay: SECOND_BROADCAST_CONFIG.each },
          )
        } else {
          // ครบ 30 นาทีสุดท้าย, ยกเลิกงานอัตโนมัติ
          await cancelShipmentQueue.add({
            shipmentId,
            message: 'ระบบทำการยกเลิกอัตโนมัติเนื่องจากไม่มีคนขับรับงาน',
            reason: EShipmentCancellationReason.OTHER,
          })
        }
        break
    }

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
}
