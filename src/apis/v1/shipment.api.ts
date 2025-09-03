import { Router } from 'express'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'

const test_api = Router()

// Endpoint สำหรับทดสอบการแจ้งเตือนแบบทั่วไป
test_api.get('/test/message-notification/:userId', async (req, res) => {
  const { userId } = req.params
  const { fcmFlag } = req.query
  console.log('fcmFlag', fcmFlag)
  try {
    await NotificationModel.sendNotification(
      {
        userId,
        varient: ENotificationVarient.INFO,
        title: 'ทดสอบ Notification',
        message: [`ระบบกำลังทดสอบการแจ้งเตือน`],
      },
      undefined,
      fcmFlag === 'Y',
    )
    res.status(200).send(`Successfully Nottfication`)
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`)
  }
})

export default test_api
