import {
  checkBillingStatus,
  emailIssueBillingToCustomer,
  issueCreditBilling,
  notifyIssueBillingToCustomer,
  notifyNearbyDuedate,
  notifyOverdueBilling,
} from '@controllers/billing'
import cron from 'node-cron'
// import BillingModel from '@models/finance/billing.model'
// import { BillingDocument } from '@models/finance/documents.model'
// import { Receipt } from '@models/finance/receipt.model'
// import { last, sortBy } from 'lodash'
// import { generateReceipt } from 'reports/receipt'

export default async function configureCronjob() {
  cron.schedule(
    '0 0 * * *',
    async () => {
      await issueCreditBilling()
      await checkBillingStatus()

      /**
       * Overdue
       */
      await notifyOverdueBilling()
    },
    { timezone: 'Asia/Bangkok' },
  )

  cron.schedule(
    '0 8 * * *',
    async () => {
      /**
       * Invoice
       */
      await emailIssueBillingToCustomer()
      await notifyIssueBillingToCustomer()

      /**
       * Due Date
       */
      await notifyNearbyDuedate(3)
      await notifyNearbyDuedate(1)
      await notifyOverdueBilling()
    },
    { timezone: 'Asia/Bangkok' },
  )

  console.log('🌽 Cronjob started')
  // await checkBillingStatus()
  // await notifyIssueEmailToCustomer()
  // await BillingCycleModel.createBillingCycleForUser("66cdac28ae254a56f48c843e")
  // await issueEmailToCustomer()
  // const _billing = await BillingModel.findOne({ billingNumber: 'MMTH000069' })
  // const _receipt = last(sortBy(_billing.receipts, 'createdAt')) as Receipt
  // const _document = _receipt.document as BillingDocument
  // const { fileName } = await generateInvoice(biili)
  // const { fileName } = await generateReceipt(_billing, _document.filename)
  // console.log('fileName: ', fileName)
}
