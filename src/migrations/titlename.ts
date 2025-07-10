import mongoose from 'mongoose'
import { connectToMongoDB } from '@configs/mongodb.config'

import dotenv from 'dotenv'
import IndividualCustomerModel from '@models/customerIndividual.model'
import BusinessCustomerModel from '@models/customerBusiness.model'
dotenv.config()

const INDIVIDUAL_TITLE_NAME_OPTIONS = [
  { value: 'Miss', label: 'นางสาว' },
  { value: 'Mrs.', label: 'นาง' },
  { value: 'Mr.', label: 'นาย' },
  { value: 'other', label: 'อื่นๆ' },
]

const BUSINESS_TITLE_NAME_OPTIONS = [
  { value: 'Co', label: 'บจก.' },
  { value: 'Part', label: 'หจก.' },
  { value: 'Pub', label: 'บมจ.' },
]

async function migrateTitleName() {
  try {
    await connectToMongoDB()
    // Individual Customer
    const individualCustomerToMigrate = await IndividualCustomerModel.find()

    if (individualCustomerToMigrate.length === 0) {
      console.log('ไม่พบข้อมูลที่ต้อง Migrate')
      return
    }

    const _individualCustomerBulkOperations = individualCustomerToMigrate.map((doc) => {
      const titleName = doc.title
      const titleFound = INDIVIDUAL_TITLE_NAME_OPTIONS.find((option) => option.value === titleName)
      let newTitleName = titleName
      if (titleFound) {
        newTitleName = titleFound.label
      }
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { title: newTitleName } },
        },
      }
    })

    if (_individualCustomerBulkOperations.length > 0) {
      const result = await IndividualCustomerModel.bulkWrite(_individualCustomerBulkOperations)
      console.log('ผลการ Migrate ข้อมูล Individual Customer:')
      console.log(`- จำนวนเอกสารที่ได้รับการแก้ไข: ${result.modifiedCount}`)
    }

    // Businesse Customer
    const businessCustomerToMigrate = await BusinessCustomerModel.find()

    if (businessCustomerToMigrate.length === 0) {
      console.log('ไม่พบข้อมูลที่ต้อง Migrate')
      return
    }

    const _businessCustomerBulkOperations = businessCustomerToMigrate.map((doc) => {
      const titleName = doc.businessTitle
      const titleFound = BUSINESS_TITLE_NAME_OPTIONS.find((option) => option.value === titleName)
      let newTitleName = titleName
      if (titleFound) {
        newTitleName = titleFound.label
      }
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { businessTitle: newTitleName } },
        },
      }
    })

    if (_businessCustomerBulkOperations.length > 0) {
      const result = await BusinessCustomerModel.bulkWrite(_businessCustomerBulkOperations)
      console.log('ผลการ Migrate ข้อมูล Business Customer:')
      console.log(`- จำนวนเอกสารที่ได้รับการแก้ไข: ${result.modifiedCount}`)
    }
  } catch (error) {
    console.error('เกิดข้อผิดพลาดระหว่างการ Migrate:', error)
  } finally {
    await mongoose.disconnect()
  }
}

migrateTitleName()
