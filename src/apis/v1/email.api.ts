import addEmailQueue from '@utils/email.utils'
import { Router } from 'express'

const email_api = Router()

email_api.get('/sample', async (req, res) => {
  const email_to = (req.query.to as string) || 'jennarong.sae@gmail.com'
  await addEmailQueue({
    from: process.env.MAILGUN_SMTP_EMAIL,
    to: email_to,
    subject: 'Testiing email',
    template: 'simple',
    context: {
      name: 'GGWP',
      message: 'This is GGWP message',
    },
  })
  // const host = getCurrentHost(ctx)
  // const activate_link = `${host}/api/v1/activate/customer/${user.userNumber}`
  // const movemate_link = `https://www.movematethailand.com`
  // await email_transpoter.sendMail({
  //     from: process.env.NOREPLY_EMAIL,
  //     to: email_to,
  //     subject: 'ยืนยันการสมัครสมาชิก Movemate!',
  //     template: 'register_individual',
  //     context: {
  //         fullname: 'เจนณรงค์ แสนแปง',
  //         username: "jennarong.sae@mail.com",
  //         activate_link: `https://api.movemateth.com/activate/customer/44444444`,
  //         movemate_line: `https://www.movematethailand.com`,
  //     }
  // })

  res.status(200).send('email has sent')
})
export default email_api
