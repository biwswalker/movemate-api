import {
  checkBillingStatus,
  emailIssueBillingToCustomer,
  issueCreditBilling,
  notifyIssueBillingToCustomer,
  notifyNearbyDuedate,
  notifyOverdueBilling,
} from '@controllers/billing'
import { fDateTime } from '@utils/formatTime'
import cron from 'node-cron'

export default async function configureCronjob() {
  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log(`🟢 Start CronJob: ${fDateTime(new Date())} Issue credit billing process!`)
      await issueCreditBilling()
      await checkBillingStatus()

      /**
       * Overdue
       */
      await notifyOverdueBilling()
      console.log(`🛑 End CronJob: ${fDateTime(new Date())} Issue credit billing process!`)
    },
    { timezone: 'Asia/Bangkok' },
  )

  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log(`🟢 Start CronJob: ${fDateTime(new Date())} Billing email notification process!`)
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
      console.log(`🛑 End CronJob: ${fDateTime(new Date())} Billing email notification process!`)
    },
    { timezone: 'Asia/Bangkok' },
  )

  console.log('🌽 Cronjob started')
}
