import { EPaymentMethod } from '@enums/payments'
import { EUserType } from '@enums/users'
import BillingModel from '@models/finance/billing.model'
import BillingDocumentModel from '@models/finance/documents.model'
import { Shipment } from '@models/shipment.model'
import UserModel from '@models/user.model'
import addEmailQueue from '@utils/email.utils'
import { format } from 'date-fns'
import { get, head, last, reduce, tail, uniq } from 'lodash'
import { ClientSession } from 'mongoose'
import { generateReceipt } from 'reports/receipt'

export async function generateBillingReceipt(billingId: string, sentEmail?: boolean, session?: ClientSession) {
  /**
   * Generate receipt
   */
  const _billing = await BillingModel.findById(billingId).session(session)
  const { filePath, fileName, document } = await generateReceipt(_billing)

  console.log('Generate receipt document: ', document)
  /**
   * Email
   */
  if (sentEmail) {
    const _customer = await UserModel.findById(get(_billing, 'user._id', ''))
    const _isCashReceipt = _billing.paymentMethod === EPaymentMethod.CASH
    if (_isCashReceipt && _customer) {
      const shipment = last(_billing.shipments) as Shipment | undefined
      const financialEmails = get(_customer, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = uniq([_customer.email, ...financialEmails])
      const pickup = head(shipment.destinations)?.name || ''
      const dropoffs = reduce(
        tail(shipment?.destinations),
        (prev, curr) => {
          if (curr.name) {
            return prev ? `${prev}, ${curr.name}` : curr.name
          }
          return prev
        },
        '',
      )
      const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${shipment.trackingNumber}`

      const isTaxIncluded = _billing.amount.tax > 0
      const _customerTypeText = _customer.userType === EUserType.INDIVIDUAL ? 'ส่วนบุคคล' : 'บริษัท/องค์กร'
      if (isTaxIncluded) {
        await addEmailQueue({
          from: process.env.NOREPLY_EMAIL,
          to: emails,
          subject: `ขอบคุณที่ใช้บริการ Movemate Thailand | Shipment No. ${shipment.trackingNumber}`,
          template: 'cash_wht_receipt',
          context: {
            tracking_number: shipment.trackingNumber,
            fullname: _customer.fullname,
            phone_number: _customer.contactNumber,
            email: _customer.email,
            customer_type: _customerTypeText,
            pickup,
            dropoffs,
            tracking_link,
            contact_number: '02-xxx-xxxx',
            movemate_link: `https://www.movematethailand.com`,
          },
          attachments: [{ filename: fileName, path: filePath }],
        })
      } else {
        await addEmailQueue({
          from: process.env.NOREPLY_EMAIL,
          to: emails,
          subject: `ใบเสร็จรับเงิน Movemate Thailand | Shipment No. ${shipment.trackingNumber}`,
          template: 'cash_receipt',
          context: {
            tracking_number: shipment.trackingNumber,
            fullname: _customer.fullname,
            phone_number: _customer.contactNumber,
            email: _customer.email,
            customer_type: _customerTypeText,
            pickup,
            dropoffs,
            tracking_link,
            contact_number: '02-xxx-xxxx',
            movemate_link: `https://www.movematethailand.com`,
          },
          attachments: [{ filename: fileName, path: filePath }],
        })
      }

      console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
      await BillingDocumentModel.findByIdAndUpdate(document._id, { emailTime: new Date().toISOString() }, { session })
    } else {
      // Send email to CREDIT
    }
    return document._id
  }
}
