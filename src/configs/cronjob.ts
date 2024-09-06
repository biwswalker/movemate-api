import BillingCycleModel, { checkBillingStatus, generateInvoice, issueBillingCycle, issueEmailToCustomer, notifyDuedate, notifyIssueEmailToCustomer, notifyNearby1Duedate, notifyNearby3Duedate, notifyOverdue } from '@models/billingCycle.model'
import cron from 'node-cron'

export default async function configureCronjob() {
  cron.schedule('0 0 * * *', async () => {
    await issueBillingCycle()
    await checkBillingStatus()

    /**
     * Overdue
     */
    await notifyOverdue()
  }, { timezone: 'Asia/Bangkok' })

  cron.schedule('0 8 * * *', async () => {
    /**
     * Invoice
     */
    await issueEmailToCustomer()
    await notifyIssueEmailToCustomer()

    /**
     * Due Date
     */
    await notifyNearby3Duedate()
    await notifyNearby1Duedate()
    await notifyDuedate()
  }, { timezone: 'Asia/Bangkok' })

  console.log('🌽 Cronjob started')
  // await checkBillingStatus()
  // await notifyIssueEmailToCustomer()
  // await BillingCycleModel.createBillingCycleForUser("66cdac28ae254a56f48c843e")
  // await issueEmailToCustomer()
  // const biili = await BillingCycleModel.findOne({ billingNumber: 'IV082567000007' })
  // const { fileName } = await generateInvoice(biili)
  // console.log('fileName: ', fileName)
}