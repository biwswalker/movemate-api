import {
  checkBillingStatus,
  emailIssueBillingToCustomer,
  issueCreditBilling,
  notifyIssueBillingToCustomer,
  notifyNearbyDuedate,
  notifyOverdueBilling,
} from '@controllers/billing'
import cron from 'node-cron'

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
  // const biili = await BillingCycleModel.findOne({ billingNumber: 'MMTH000037' })
  // const { fileName } = await generateReceiptCashWithNonTax(biili, biili.issueReceiptFilename)
  // const { fileName } = await generateInvoice(biili)
  // console.log('fileName: ', fileName)
}
