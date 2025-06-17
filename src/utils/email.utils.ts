import { emailSenderQueue } from '@configs/jobQueue'
import { Job } from 'bull'
import { format } from 'date-fns'
import { TransportOptions, createTransport } from 'nodemailer'
import nodemailerExpressHandlebars, { HbsTransporter, TemplateOptions } from 'nodemailer-express-handlebars'
import Mail from 'nodemailer/lib/mailer'
import mgTransporter from 'nodemailer-mailgun-transport'
import { join } from 'path'
import fs from 'fs'
import get from 'lodash/get'
import omit from 'lodash/omit'

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

  // ตรวจสอบและจัดการไฟล์แนบ
  if (content.attachments && content.attachments.length > 0) {
    // ใช้ loop แบบย้อนกลับเพื่อลบ item ออกจาก array ได้ง่ายขึ้น
    for (let i = content.attachments.length - 1; i >= 0; i--) {
      let attachment = content.attachments[i]

      // เฉพาะไฟล์แนบที่ระบุ path มาเท่านั้น และยังไม่มี content (Buffer/Stream) หรือ encoding เป็น 'base64'
      if (typeof attachment.path === 'string' && !attachment.content && attachment.encoding !== 'base64') {
        try {
          const filePath = attachment.path // เก็บพาธไฟล์ที่เป็น string

          // อ่านไฟล์ทั้งหมดเป็น Buffer และแปลงเป็น Base64 string
          attachment.cid = attachment.filename || 'attachment'
          // อ่านไฟล์ทั้งหมดเป็น Buffer และแปลงเป็น Base64 string
          attachment.content = fs.readFileSync(filePath).toString('base64')
          // ระบุ encoding เป็น 'base64'
          attachment.encoding = 'base64'
          // ลบ property 'path' ออก เพราะตอนนี้เนื้อหาอยู่ใน 'content' แล้ว
          delete attachment.path

          console.log(`Successfully read attachment file into Base64 string: ${attachment.filename}`)
        } catch (readError) {
          console.error(`Failed to read attachment file ${attachment.path}:`, readError)
          // หากอ่านไฟล์ไม่ได้ ให้ลบไฟล์แนบนี้ออกจาก list เพื่อไม่ให้เกิด error ในการส่ง
          content.attachments.splice(i, 1)
          console.warn(`Attachment ${attachment.filename} was removed due to read error.`)
        }
      } else if (attachment.content && attachment.encoding === 'base64') {
        // ถ้า content ถูกกำหนดเป็น Base64 มาแล้ว ก็ไม่จำเป็นต้องทำอะไร
        console.log(`Attachment ${attachment.filename} already has Base64 content.`)
      }
    }
  }

  await emailSenderQueue.add(content)
}

emailSenderQueue.process(async (job: Job<Mail.Options & TemplateOptions>) => {
  try {
    const _attachments = get(job, 'data.attachments', []) || []
    const _displayData = _attachments.length > 0 ? { ...job.data, attachments: _attachments.map(attachment => omit(attachment, 'content')) } : job.data
    console.log('Queue email sender: ', format(new Date(), 'HH:mm:ss'), `Job ID: ${job.id}`, _displayData)
    const transporter = email_sender()
    await transporter.sendMail(job.data)
    console.log('Queue email sender complete!: ', format(new Date(), 'dd-MM-yyyy HH:mm:ss'), `Job ID: ${job.id}`, _displayData)
  } catch (error) {
    console.log('Queue email sender error: ', format(new Date(), 'dd-MM-yyyy HH:mm:ss'), error)
  }
})

export default addEmailQueue
