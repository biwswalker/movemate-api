import { Queue, Worker } from 'bullmq'
import { format } from 'date-fns'
import { Redis } from 'ioredis'

export enum QUEUE_NAMES {
  SHIPMENT_NOTIFICATION = 'SHIPMENT_NOTIFICATION_QUEUE',
}

export const shipmentNotificationQueue = new Queue(QUEUE_NAMES.SHIPMENT_NOTIFICATION)

export function initialWorker(redis: Redis) {
  new Worker(
    QUEUE_NAMES.SHIPMENT_NOTIFICATION,
    async (job) => {
      console.log('job: ', QUEUE_NAMES.SHIPMENT_NOTIFICATION, format(new Date(), 'HH:mm:ss', job.data))
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null
      },
    },
  )
}

export async function mock() {
  console.log('start queue')
  await shipmentNotificationQueue.add(
    QUEUE_NAMES.SHIPMENT_NOTIFICATION,
    { shipment: 1, lin: 4 },
    {
      repeat: {
        every: 5000,
        limit: 12,
        // immediately: true,
      },
    //   jobId: `123231`,
    },
  )
  console.log('end queue')
}
