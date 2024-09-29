import Bull from 'bull'
import { TemplateOptions } from 'nodemailer-express-handlebars'
import Mail from 'nodemailer/lib/mailer'

export const FIVE_MIN = 5 * 60 * 1000
export const TEN_MIN = 10 * 60 * 1000
export const TWENTY_MIN = 20 * 60 * 1000
export const TWO_HOUR = 120 * 60 * 1000
export const TWO_HALF_HOUR = 150 * 60 * 1000
export const DEFAULT_LIMIT = 12

export interface ShipmentPayload {
  shipmentId: string
}

export interface ShipmentResumePayload {
  shipmentId: string
  every: number
  limit: number
}

export interface FCMShipmentPayload extends ShipmentPayload {
  driverId?: string
}

// สร้าง queue สำหรับ monitor shipment
export const monitorShipmentQueue = new Bull<FCMShipmentPayload>('monitorShipment', {
  defaultJobOptions: { repeat: { every: TEN_MIN, limit: DEFAULT_LIMIT } },
})

// สร้าง queue สำหรับ update job
export const rejectedFavoritDriverQueue = new Bull<ShipmentResumePayload>('rejectedFavoritDriver')
export const updateMonitorQueue = new Bull<ShipmentResumePayload>('updateMonitor')
export const cancelShipmentQueue = new Bull<ShipmentPayload>('cancelShipment')

// สร้าง queue สำหรับ email job
export const emailSenderQueue = new Bull<Mail.Options & TemplateOptions>('emailSender')
// 

// Remove all job queue
export async function obliterateQueue() {
  try {
    await monitorShipmentQueue.obliterate({ force: true })
    await rejectedFavoritDriverQueue.obliterate({ force: true })
    await updateMonitorQueue.obliterate({ force: true })
    await cancelShipmentQueue.obliterate({ force: true })

    console.log('Queue obliterated.')
  } catch (error) {
    console.error('Error obliterating queue:', error)
  }
}

// Remove job queue
export async function removeMonitorShipmentJob(jobId: string) {
  try {
    await monitorShipmentQueue.removeRepeatable({ jobId, every: TEN_MIN })
    console.log(`Queue ${jobId} removed.`)
  } catch (error) {
    console.error('Error obliterating queue:', error)
  }
}
