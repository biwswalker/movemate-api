import { MiddlewareFn } from 'type-graphql'
import mongoose from 'mongoose'
import { GraphQLContext } from '@configs/graphQL.config'

// Retry Middleware ที่ถูกต้องตาม type ของ TypeGraphQL
const RetryTransactionMiddleware: MiddlewareFn<GraphQLContext> = async ({ context, args }, next) => {
  const maxRetries = 5
  let retries = 0
  const session = await mongoose.startSession()

  try {
    while (retries < maxRetries) {
      session.startTransaction()

      // เพิ่ม session ใน context เพื่อให้ resolver ใช้ได้
      context.session = session

      // เรียก next() เพื่อดำเนินการต่อใน resolver
      const result = await next()

      // commit transaction ถ้าผ่าน
      await session.commitTransaction()
      return result // หยุด retry ถ้าสำเร็จ
    }
  } catch (error) {
    console.log('RetryTransactionMiddleware Error: ', error)
    if (error.code === 112) {
      // ถ้าเกิด write conflict
      retries++
      console.log(`Retry attempt ${retries}/${maxRetries}...`)
      await session.abortTransaction() // Abort แล้ว retry ใหม่
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 100)) // Backoff strategy

      if (retries === maxRetries) {
        console.log('Max retries exceeded. Aborting transaction.')
        throw error // เมื่อ retry ไม่สำเร็จให้โยน error ออกไป
      }
    } else {
      // ถ้าเกิดข้อผิดพลาดอื่นๆ ให้ abort และโยน error ทันที
      await session.abortTransaction()
      throw error
    }
  } finally {
    session.endSession() // End session เมื่อเสร็จสิ้น
  }
}

export default RetryTransactionMiddleware
