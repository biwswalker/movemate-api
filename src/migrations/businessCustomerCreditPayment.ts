import mongoose from 'mongoose'
import BusinessCustomerCreditPaymentModel, { YearlyBillingCycle } from '@models/customerBusinessCreditPayment.model'
import { connectToMongoDB } from '@configs/mongodb.config'

import dotenv from 'dotenv'
import { get } from 'lodash'
import { ECreditBillingCycleType } from '@enums/users'
dotenv.config()

async function migrateBusinessCustomerCreditPayment() {
  try {
    await connectToMongoDB()
    const documentsToMigrate = await BusinessCustomerCreditPaymentModel.find({
      billingCycle: { $exists: false }, // เลือกเฉพาะเอกสารที่ยังไม่มีฟิลด์ billingCycle
    })

    if (documentsToMigrate.length === 0) {
      console.log('ไม่พบข้อมูลที่ต้อง Migrate')
      return
    }

    const bulkOperations = documentsToMigrate.map((doc) => {
      const billedDateType = get(doc, 'billedDateType', ECreditBillingCycleType.DEFAULT) as ECreditBillingCycleType
      const billedDate = get(doc, 'billedDate', {})
      const billedRound = get(doc, 'billedRound', {})
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

      const newBillingCycle: Partial<YearlyBillingCycle> = {}

      for (const [index, month] of months.entries()) {
        newBillingCycle[month] = {
          issueDate: get(billedDate, month, 1),
          dueDate: get(billedRound, month, 16),
          dueMonth: index + 1,
        }
      }

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              billingCycleType: billedDateType,
              billingCycle: newBillingCycle,
            },
            $unset: {
              billedDate: '',
              billedRound: '',
              billedDateType: '',
              billedRoundType: '',
            },
          },
        },
      }
    })

    if (bulkOperations.length > 0) {
      const result = await BusinessCustomerCreditPaymentModel.bulkWrite(bulkOperations)
      console.log('ผลการ Migrate ข้อมูล:')
      console.log(`- จำนวนเอกสารที่ตรงเงื่อนไข: ${result.matchedCount}`)
      console.log(`- จำนวนเอกสารที่ได้รับการแก้ไข: ${result.modifiedCount}`)
    }

    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('เกิดข้อผิดพลาดระหว่างการ Migrate:', error)
  } finally {
    await mongoose.disconnect()
  }
}

migrateBusinessCustomerCreditPayment()
