import { EPaymentMethod } from '@enums/payments'
import { EUserType } from '@enums/users'
import BillingModel from '@models/finance/billing.model'
import BillingDocumentModel from '@models/finance/documents.model'
import { Receipt } from '@models/finance/receipt.model'
import { Shipment } from '@models/shipment.model'
import UserModel from '@models/user.model'
import addEmailQueue from '@utils/email.utils'
import { REPONSE_NAME } from 'constants/status'
import { format } from 'date-fns'
import { GraphQLError } from 'graphql'
import { get, head, last, reduce, sortBy, tail, uniq } from 'lodash'
import { ClientSession } from 'mongoose'
import { generateNonTaxReceipt } from 'reports/nonTaxReceipt'
import { generateReceipt } from 'reports/receipt'

export async function generateBillingReceipt(billingId: string, sentEmail?: boolean, session?: ClientSession) {
  /**
   * Generate receipt
   */
  const _billing = await BillingModel.findById(billingId).session(session)
  const _customerId = get(_billing, 'user._id', '')
  const _customer = await UserModel.findById(_customerId).session(session)
  const _receipt = last(sortBy(_billing.receipts, 'createdAt')) as Receipt | undefined
  if (!_billing || !_receipt || !_customer) {
    const message = 'ไม่พบข้อมูล'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  const { filePath, fileName, document } =
    _billing.paymentMethod === EPaymentMethod.CASH && _customer.userType === EUserType.INDIVIDUAL
      ? await generateNonTaxReceipt(_billing, _receipt, session)
      : await generateReceipt(_billing, undefined, session)

  console.log('Generate receipt document: ', document)
  /**
   * Email
   */
  if (sentEmail) {
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
      if (isTaxIncluded && _customer.userType === EUserType.BUSINESS) {
        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
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
          // attachments: [{ filename: fileName, path: filePath }], // Uncomment if you want to attach the receipt
        })
      } else {
        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
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
