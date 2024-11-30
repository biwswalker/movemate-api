import { EUserRole, EUserStatus } from '@enums/users'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import UserModel from '@models/user.model'
import { verifyExpToken } from '@utils/encryption'
import { Router } from 'express'

const activate_api = Router()

activate_api.get('/customer/:user_number', async (req, res) => {
  try {
    const rawUserNumber = req.params.user_number
    const userToken = verifyExpToken<{ userNumber }>(rawUserNumber)
    if (userToken.userNumber) {
      const user = await UserModel.findOne({ userNumber: userToken.userNumber, userRole: EUserRole.CUSTOMER })
      if (!user) {
        throw Error('ไม่พบผู้ใช้')
      }
      const username = user.username
      if (user.isVerifiedEmail) {
        res.redirect(`https://www.movematethailand.com/activate/exist/${username}`)
      } else {
        await user.updateOne({ status: EUserStatus.ACTIVE, isVerifiedEmail: true })
        await NotificationModel.sendNotification({
          userId: user._id,
          varient: ENotificationVarient.INFO,
          title: 'ท่านได้ยืนยันอีเมลใช้งานของท่านแล้ว',
          message: [`Movemate Thailand ขอขอบคุณที่สมัครสมาชิก หมายเลขบัญชีของท่านคือ ${userToken.userNumber}`],
          infoText: 'ดูโปรไฟล์',
          infoLink: '/main/profile',
        })
        res.redirect(`https://www.movematethailand.com/activate/success/${username}`)
      }
    } else {
      throw Error('รหัสผู้ใช้ไม่สมบูรณ์')
    }
  } catch (error) {
    res.redirect('https://www.movematethailand.com/activate/error')
  }
})

export default activate_api