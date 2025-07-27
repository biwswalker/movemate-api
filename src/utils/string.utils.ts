import { GraphQLContext } from '@configs/graphQL.config'
import redis from '@configs/redis'
import CouterModel from '@models/counter.model'
import padStart from 'lodash/padStart'
import { format, fromZonedTime } from 'date-fns-tz'
import { endOfMonth } from 'date-fns'

export function generateRandomNumberPattern(pattern = 'MM##########'): string {
  let trackingNumber: string = ''

  for (let i = 0; i < pattern.length; i++) {
    const currentChar: string = pattern.charAt(i)
    if (currentChar === '#') {
      trackingNumber += Math.floor(Math.random() * 10).toString()
    } else {
      trackingNumber += currentChar
    }
  }

  return trackingNumber
}

export const generateOTP = (length = 6) => {
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)]
  }
  return otp
}

export const generateRef = (length = 4) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = ''
  for (let i = 0; i < length; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

export async function generateId(prefix: string, type: TGenerateIDType) {
  const counter = await CouterModel.getNextCouter(type)
  // const nowUTC = utcToZonedTime(new Date(), 'UTC')
  // const datetime_id = format(nowUTC, 'yyMM')
  const running_id = padStart(`${counter}`, 4, '0')
  return `${prefix}${running_id}`
}

export async function generateTrackingNumber(prefix: string, type: TGenerateIDType, len = 6, random = false) {
  const counter = await CouterModel.getNextCouter(type)
  const counterNumberStr = `${counter}`
  const running_id =
    counterNumberStr.length > len ? counterNumberStr : padStart(counterNumberStr, len, random ? '#' : '0')
  const replace_text = random ? generateRandomNumberPattern(running_id) : running_id
  return `${prefix}${replace_text}`
}

export function getCurrentHost(ctx: GraphQLContext) {
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const host = ctx.req.get('host')
  const activate_link = `${protocol}://${host}`
  return activate_link
}

export async function generateMonthlySequenceNumber(docType: TDocumentType, length: number = 3): Promise<string> {
  const now = new Date()
  // Ensure date calculations are based on 'Asia/Bangkok' timezone
  const todayInBangkok = fromZonedTime(now, 'Asia/Bangkok')

  // Format: two-digit year, two-digit month (e.g., 2501 for Jan 2025)
  const yearMonth = format(todayInBangkok, 'yyMM')

  let prefix = ''
  let redisKeyType = ''

  switch (docType) {
    case 'invoice':
      prefix = 'IV'
      redisKeyType = 'invoice_monthly_seq'
      break
    case 'receipt':
      prefix = 'RE'
      redisKeyType = 'receipt_monthly_seq'
      break
    case 'creditnote':
      prefix = 'CR' // Assuming 'ADJ' as a prefix for creditnote documents
      redisKeyType = 'creditnote_monthly_seq'
      break
    case 'debitnote':
      prefix = 'DR' // Assuming 'ADJ' as a prefix for debitnote documents
      redisKeyType = 'debitnote_monthly_seq'
      break
    case 'advancereceipt':
      prefix = 'ADV' // Assuming 'ADJ' as a prefix for debitnote documents
      redisKeyType = 'advance_receipt_monthly_seq'
      break
    case 'refundnote':
      prefix = 'RFD' // Assuming 'ADJ' as a prefix for debitnote documents
      redisKeyType = 'refund_receipt_monthly_seq'
      break
    default:
      throw new Error(
        `Invalid document type: ${docType}. Must be 'invoice', 'receipt', 'creditnote', 'debitnote', 'advancereceipt', or 'refundnote'.`,
      )
  }

  // Construct the Redis key using the document type and the current year-month
  const redisKey = `sequence:${redisKeyType}:${yearMonth}`

  // Atomically increment the counter in Redis
  const sequenceNumber = await redis.incr(redisKey)

  // If the sequence number is 1, it means this is the first number for the current month.
  // Set an expiration (TTL) for the key to the end of the current month.
  // This ensures the counter automatically resets for the next month.
  if (sequenceNumber === 1) {
    const endOfCurrentMonth = endOfMonth(todayInBangkok)
    const nowMilliseconds = todayInBangkok.getTime()
    const endOfMonthMilliseconds = endOfCurrentMonth.getTime()
    const ttlInSeconds = Math.floor((endOfMonthMilliseconds - nowMilliseconds) / 1000)

    // Ensure TTL is positive, handle cases where endOfMonth might be in the past due to time difference
    if (ttlInSeconds > 0) {
      await redis.expire(redisKey, ttlInSeconds)
    } else {
      // If ttlInSeconds is 0 or negative, expire immediately or very soon
      await redis.expire(redisKey, 1)
    }
  }

  // Pad the sequence number with leading zeros to the desired length
  const paddedSequence = padStart(String(sequenceNumber), length, '0')

  // Combine the prefix, year-month, and padded sequence number
  return `${prefix}${yearMonth}${paddedSequence}`
}
