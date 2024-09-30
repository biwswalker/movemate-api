import Redis, { RedisOptions } from 'ioredis'
import dotenv from 'dotenv'
import { initialWorker } from './workQueue'

// Load environment variables from .env file
dotenv.config()

const host = process.env.REDIS_HOST || '0.0.0.0'
const port = Number(process.env.REDIS_PORT || 6379)
const password = String(process.env.REDIS_PASSWORD || '')
export const redusOptions: RedisOptions = { port, host, ...(password ? { password } : {}), maxRetriesPerRequest: null }
const redis = new Redis(redusOptions)
redis.on('connect', () => {
  console.log('🍄 Redis connected! listen at: ', port)
  initialWorker(redis)
})

export default redis
