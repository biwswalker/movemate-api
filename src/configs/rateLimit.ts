import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import redis from './redis'
import pubsub, { LOCATIONS } from './pubsub'
import { includes } from 'lodash'

export enum ELimiterType {
  LOCATION = 'location-search',
}

function generatedRediskey(ip: string, type: ELimiterType, key: string) {
  if(includes('::1', key)) {
    return `${type}:localhost:${ip}`
  }
  return `${type}:${key}:${ip}`
}

export async function verifyRequestLimiter(ip: string, _type: ELimiterType, RATE_LIMIT = 10, userId: string = '') {
  const redisKey = generatedRediskey(ip, _type, userId) // Generate Key

  const currentCount = await redis.get(redisKey)
  const count = currentCount ? parseInt(currentCount, 10) : 0

  if (count >= RATE_LIMIT) {
    const message = `การค้นหาราคาถูกจำกัดเนื่องจาก ท่านได้ค้นหาราคาเกินจำนวนที่กำหนดและไม่ได้มีการใช้บริการ ท่านจะสามารถใช้งานได้อีกครั้งในวันถัดไป`
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.SEARCH_LIMIT, errors: [{ message }] },
    })
  }
}

export async function rateLimiter(ip: string, _type: ELimiterType, RATE_LIMIT = 10, userId: string = '') {
  const redisKey = generatedRediskey(ip, _type, userId) // Generate Key

  const currentCount = await redis.get(redisKey)
  const count = currentCount ? parseInt(currentCount, 10) : 0

  const newCount = await redis.incr(redisKey)

  if (!currentCount) {
    const now = new Date()
    const resetTime = new Date(now)
    resetTime.setHours(23, 59, 59, 999) // ตั้งค่าเวลารีเซ็ตเป็น 23:59:59.999 ของวันนี้
    const ttl = Math.floor((resetTime.getTime() - now.getTime()) / 1000)
    await redis.expire(redisKey, ttl)
  }

  const limit = RATE_LIMIT === Infinity ? -1 : RATE_LIMIT // -1 mean infinity
  // TODO: Sent only user
  await pubsub.publish(LOCATIONS.REQUEST_LIMIT, { count: newCount, limit })

  return { count, limit }
}

export async function getLatestCount(ip: string, _type: ELimiterType, userId: string = '') {
  const redisKey = generatedRediskey(ip, _type, userId) // Generate Key
  const currentCount = await redis.get(redisKey)
  const count = currentCount ? parseInt(currentCount, 10) : 0
  return count
}

export async function clearLimiter(ip: string, _type: ELimiterType, userId: string = '') {
  const redisKey = generatedRediskey(ip, _type, userId) // Generate Key
  redis.set(redisKey, 0)
}
