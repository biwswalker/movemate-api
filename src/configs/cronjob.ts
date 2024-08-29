import BillingCycleModel, { checkBillingStatus, generateInvoice, issueBillingCycle, issueEmailToCustomer } from '@models/billingCycle.model'
import cron from 'node-cron'

export default async function configureCronjob() {
  cron.schedule('0 0 * * *', async () => {
    await issueBillingCycle()
    await checkBillingStatus()
  }, { timezone: 'Asia/Bangkok' })

  cron.schedule('0 8 * * *', async () => {
    await issueEmailToCustomer()
  }, { timezone: 'Asia/Bangkok' })

  console.log('🌽 Cronjob started')
  // const biili = await BillingCycleModel.findOne({ billingNumber: 'IV082567000007' })
  // const { fileName } = await generateInvoice(biili)
  // console.log('fileName: ', fileName)
}