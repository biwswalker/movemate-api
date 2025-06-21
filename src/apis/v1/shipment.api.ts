import { Router } from 'express'
import { shipmentNotifyQueue } from '@configs/jobQueue' // Import queue ของคุณ

const test_api = Router()

// Endpoint สำหรับทดสอบการแจ้งเตือนคนขับคนโปรด
test_api.get('/test/favorite-driver/:shipmentId/:driverId', async (req, res) => {
  const { shipmentId, driverId } = req.params
  try {
    await shipmentNotifyQueue.add({
      shipmentId,
      driverId,
      stage: 'FAVORITE_DRIVER',
      iteration: 1,
    })
    res.status(200).send(`Successfully added FAVORITE_DRIVER job for Shipment ID: ${shipmentId}`)
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`)
  }
})

// Endpoint สำหรับทดสอบการแจ้งเตือนแบบทั่วไป
test_api.get('/test/broadcast/:shipmentId', async (req, res) => {
  const { shipmentId } = req.params
  try {
    await shipmentNotifyQueue.add({
      shipmentId,
      stage: 'INITIAL_BROADCAST',
      iteration: 1,
    })
    res.status(200).send(`Successfully added INITIAL_BROADCAST job for Shipment ID: ${shipmentId}`)
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`)
  }
})

export default test_api
