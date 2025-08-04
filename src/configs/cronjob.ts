import {
  checkBillingStatus,
  emailIssueBillingToCustomer,
  issueCreditBilling,
  notifyIssueBillingToCustomer,
  notifyNearbyDuedate,
  notifyOverdueBilling,
} from '@controllers/billing'
import { fDateTime } from '@utils/formatTime'
import dotenv from 'dotenv'
import cron from 'node-cron'
import logger from './logger'
import { updatePendingTransactionsToOutstanding } from '@controllers/transaction'

dotenv.config()

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

  const transactionCronSchedule = process.env.TRANSACTION_OUTSTANDING_CRON_SCHEDULE || '0 0 1 * *'
  cron.schedule(transactionCronSchedule, () => {
    logger.info(
      `🚀 Starting scheduled job: updatePendingTransactionsToOutstanding based on schedule: "${transactionCronSchedule}"`,
    )
    updatePendingTransactionsToOutstanding()
  })

  console.log('🌽 Cronjob started')
}
