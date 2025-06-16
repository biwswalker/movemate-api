import { emailSenderQueue } from '@configs/jobQueue'
import { Job } from 'bull'
import { format } from 'date-fns'
import { TransportOptions, createTransport } from 'nodemailer'
import nodemailerExpressHandlebars, { HbsTransporter, TemplateOptions } from 'nodemailer-express-handlebars'
import Mail from 'nodemailer/lib/mailer'
import mgTransporter from 'nodemailer-mailgun-transport'
import { join } from 'path'

function email_sender() {

  const mailOptions = {
    auth: {
      api_key: process.env.MAILGUN_APIKEY,
      domain: process.env.MAILGUN_DOMAIN,
    },
  }

  const transporter = createTransport(mgTransporter(mailOptions) as TransportOptions) as HbsTransporter

  transporter.use(
    'compile',
    nodemailerExpressHandlebars({
      viewEngine: {
        extname: '.hbs',
        layoutsDir: join(__dirname, '..', 'templates'),
        defaultLayout: false,
      },
      viewPath: join(__dirname, '..', 'templates'),
    }),
  )

  return transporter
}

async function addEmailQueue(content: Mail.Options & TemplateOptions) {
  console.log('Added email queue: ', format(new Date(), 'HH:mm:ss'))
  await emailSenderQueue.add(content)
}

emailSenderQueue.process(async (job: Job<Mail.Options & TemplateOptions>) => {
  try {
    console.log('Queue email sender: ', format(new Date(), 'HH:mm:ss'), job.data)
    const transporter = email_sender()
    await transporter.sendMail(job.data)
    console.log('Queue email sender complete!: ', format(new Date(), 'dd-MM-yyyy HH:mm:ss'), job.data)
  } catch (error) {
    console.log('Queue email sender error: ', format(new Date(), 'dd-MM-yyyy HH:mm:ss'), error)
  }
})

export default addEmailQueue
