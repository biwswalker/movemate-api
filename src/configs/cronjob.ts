import { checkBillingStatus, generateInvoice, issueBillingCycle, issueEmailToCustomer } from '@models/billingCycle.model'
import cron from 'node-cron'

export default function configureCronjob() {
  cron.schedule('0 0 * * *', async () => {
    await issueBillingCycle()
    await checkBillingStatus()
  }, { timezone: 'Asia/Bangkok' })

  cron.schedule('0 8 * * *', async () => {
    await issueEmailToCustomer()
  }, { timezone: 'Asia/Bangkok' })

  console.log('🌽 Cronjob started')

  // Temporary comment
  // generateInvoice()
}