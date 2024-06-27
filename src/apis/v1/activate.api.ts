import UserModel from '@models/user.model'
import { Router } from 'express'

const activate_api = Router()

activate_api.get('/customer/:user_number', async (req, res) => {
    try {
        const userNumber = req.params.user_number
        if (userNumber) {
            const user = await UserModel.findOne({ userNumber, userRole: 'customer' })
            if (!user) {
                throw Error('ไม่พบผู้ใช้')
            }
            await user.updateOne({ status: 'active', isVerifiedEmail: true })
            res.redirect('https://www.movematethailand.com/activate/success')
        } else {
            throw Error('รหัสผู้ใช้ไม่สมบูรณ์')
        }
    } catch (error) {
        res.redirect('https://www.movematethailand.com/activate/error')
    }
})

export default activate_api