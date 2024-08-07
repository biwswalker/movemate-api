import Redis from 'ioredis'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

const port = Number(process.env.REDIS_PORT || 6379)
const _password = Number(process.env.REDIS_PASSWORD || '')
const redis = new Redis(port)
redis.on('connect', () => {
  console.log('🍄 Redis connected! listen at: ', port)
})

export default redis
