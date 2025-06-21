import Queue from 'bull'
import { TemplateOptions } from 'nodemailer-express-handlebars'
import Mail from 'nodemailer/lib/mailer'
import dotenv from 'dotenv'
import { RedisOptions } from 'ioredis'
import initializeShipmentJob from '@controllers/shipmentJobQueue'
dotenv.config()

export type TNotificationStage = 'INITIAL_BROADCAST' | 'FAVORITE_DRIVER' | 'SECOND_BROADCAST'

const redisOption: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
}

export interface ShipmentPayload {
  shipmentId: string
}

export interface ShipmentNotifyPayload {
  shipmentId: string
  driverId?: string // เฉพาะกรณีเจาะจงคนขับ
  stage: TNotificationStage
  iteration: number // นับจำนวนครั้งที่ส่งในแต่ละ stage
}

export interface DeleteShipmentPayload extends ShipmentPayload {
  type?: 'uninterest' | 'idle_customer'
  message?: string
  reason?: string
}

// Notify
export const shipmentNotifyQueue = new Queue<ShipmentNotifyPayload>('shipmentNotify', { redis: redisOption })
export const cancelShipmentQueue = new Queue<DeleteShipmentPayload>('cancelShipment', { redis: redisOption })
// Email sender
export const emailSenderQueue = new Queue<Mail.Options & TemplateOptions>('emailSender', { redis: redisOption })

// Remove all job queue
export async function obliterateQueue() {
  try {
    await shipmentNotifyQueue.obliterate({ force: true })
    await cancelShipmentQueue.obliterate({ force: true })
    await emailSenderQueue.obliterate({ force: true })
    console.log('Queue obliterated.')
  } catch (error) {
    console.error('Error obliterating queue:', error)
  }
}

initializeShipmentJob()