import { GraphQLError } from "graphql";
import { REPONSE_NAME } from "constants/status";
import redis from "./redis";

async function rateLimiter(ip: string, _type: TSearchType, RATE_LIMIT = 10) {
    const redisKey = `rate-limit:${ip}`

    const currentCount = await redis.get(redisKey)
    const count = currentCount ? parseInt(currentCount, 10) : 0

    if (count >= RATE_LIMIT) {
        const message = `การค้นหาราคาถูกจำกัดเนื่องจาก ท่านได้ค้นหาราคาเกินจำนวนที่กำหนดและไม่ได้มีการใช้บริการ ท่านจะสามารถใช้งานได้อีกครั้งในวันถัดไป`;
        throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.SEARCH_LIMIT, errors: [{ message }] },
        });
    }

    await redis.incr(redisKey)

    if (!currentCount) {
        const now = new Date();
        const resetTime = new Date(now);
        resetTime.setHours(23, 59, 59, 999); // ตั้งค่าเวลารีเซ็ตเป็น 23:59:59.999 ของวันนี้
        const ttl = Math.floor((resetTime.getTime() - now.getTime()) / 1000);
        await redis.expire(redisKey, ttl);
    }

    return { count, limit: RATE_LIMIT }
}

async function getLatestCount(ip: string, _type: TSearchType) {
    const redisKey = `rate-limit:${ip}`
    const currentCount = await redis.get(redisKey)
    const count = currentCount ? parseInt(currentCount, 10) : 0
    return count
}

export { rateLimiter, getLatestCount }