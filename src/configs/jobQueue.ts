import Bull from 'bull'

export const TEN_MIN = 0.1 * 60 * 1000
export const TWO_HOUR = 1.2 * 60 * 1000
export const FOUR_HOUR = 2.4 * 60 * 1000
const DEFAULT_LIMIT = 12

export interface ShipmentPayload {
  shipmentId: string
}

export interface FCMShipmentPayload extends ShipmentPayload {
  driverId?: string
}

// สร้าง queue สำหรับ monitor shipment
export const monitorShipmentQueue = new Bull<FCMShipmentPayload>('monitorShipment', {
  defaultJobOptions: { repeat: { every: TEN_MIN, limit: DEFAULT_LIMIT } },
})

// สร้าง queue สำหรับ update job
export const updateMonitorQueue = new Bull<ShipmentPayload>('updateMonitor')

// สร้าง queue สำหรับ cancel shipment
export const cancelShipmentQueue = new Bull<ShipmentPayload>('cancelShipment')

// Remove all job queue
export async function obliterateQueue() {
  try {
    await monitorShipmentQueue.obliterate({ force: true })
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
