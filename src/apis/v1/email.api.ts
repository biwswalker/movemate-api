import { email_sender } from '@utils/email.utils'
import { Router } from 'express'

const email_api = Router()

email_api.get('/sample', async (req, res) => {
    const email_to = req.query.to as string || 'jennarong.sae@gmail.com'
    const email_transpoter = email_sender()
    await email_transpoter.sendMail({
        from: process.env.GOOGLE_MAIL,
        to: email_to,
        subject: 'Testiing email',
        template: 'simple',
        context: {
            name: 'GGWP',
            message: 'This is GGWP message'
        }
    })

    res.status(200).send('email has sent')
})
export default email_api