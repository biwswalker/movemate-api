import { Router } from 'express'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import addEmailQueue from '@utils/email.utils'

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

// Endpoint สำหรับทดสอบ Email template
test_api.get('/test/message-email/:email', async (req, res) => {
  const { email: targetEmail } = req.params
  try {
    const _trackingNumber = 'MM1212312121'
    const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${_trackingNumber}`
    const movemate_link = `https://www.movematethailand.com`
    const email = targetEmail
    const fullname = 'Mr.Full Username'
    const originalText = 'ชื่อต้นทาง'
    const destinationsText = 'ชื่อปลายทาง'

    await addEmailQueue({
      from: process.env.MAILGUN_SMTP_EMAIL,
      to: email,
      subject: 'Movemate Thailand ได้รับการจองรถของคุณแล้ว',
      template: 'booking_cash_success',
      context: {
        fullname,
        tracking_number: _trackingNumber,
        original: originalText,
        destination: destinationsText,
        payment: 'ชำระเงินสด (ผ่านการโอน)',
        tracking_link,
        movemate_link,
      },
    })

    res.status(200).send(`Successfully Email sender`)
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`)
  }
})

export default test_api
