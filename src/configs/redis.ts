import Redis from 'ioredis'

const redis = Redis.createClient()

export function configuredRedis() {
  const port = Number(process.env.REDIS_PORT || 6379)

  const redis = new Redis(port)
  redis.on('connect', () => {
    console.log('🍄 Redis connected! listen at: ', port)

  })
}

export default redis