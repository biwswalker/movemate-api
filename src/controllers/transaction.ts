import TransactionModel, { ETransactionStatus } from '@models/transaction.model'
import { startOfMonth } from 'date-fns'
import logger from '@configs/logger' // Import logger

/**
 * อัปเดตสถานะของ Transaction ที่เป็น PENDING และสร้างขึ้นก่อนเดือนปัจจุบัน
 * ให้กลายเป็น OUTSTANDING (ค้างชำระ)
 */
export async function updatePendingTransactionsToOutstanding(): Promise<void> {
  try {
    // 1. หาวันที่เริ่มต้นของเดือนปัจจุบัน
    const startOfCurrentMonth = startOfMonth(new Date())

    logger.info('[CronJob] Running updatePendingTransactionsToOutstanding...')
    logger.info(`[CronJob] Finding PENDING transactions created before ${startOfCurrentMonth.toISOString()}`)

    // 2. ค้นหาและอัปเดต Transaction ทั้งหมดที่ตรงตามเงื่อนไข
    const result = await TransactionModel.updateMany(
      {
        // เงื่อนไข: สถานะเป็น PENDING และสร้างก่อนวันแรกของเดือนนี้
        status: ETransactionStatus.PENDING,
        createdAt: { $lt: startOfCurrentMonth },
      },
      {
        // สิ่งที่จะอัปเดต: เปลี่ยนสถานะเป็น OUTSTANDING
        $set: { status: ETransactionStatus.OUTSTANDING },
      },
    )

    if (result.modifiedCount > 0) {
      logger.info(`[CronJob] Successfully updated ${result.modifiedCount} transactions to OUTSTANDING.`)
    } else {
      logger.info('[CronJob] No pending transactions needed an update.')
    }
  } catch (error) {
    logger.error('[CronJob] Error running updatePendingTransactionsToOutstanding:', error)
  }
}
