import CacheModel from '@models/cache.model'
import logger from './logger'

const CACHE_EXPIRATION_TIMES: { [key: string]: number } = {
    geocode: 24 * 60 * 60, // 24 hours
    places: 7 * 24 * 60 * 60, // 7 days
    routes: 30 * 24 * 60 * 60, // 30 days
};

async function loadCache(cacheType: string, key: string): Promise<any | null> {
    try {
        const cacheEntry = await CacheModel.findOne({ key: `${cacheType}:${key}` });
        if (cacheEntry) {
            const currentTime = Date.now();
            if ((currentTime - cacheEntry.timestamp) < CACHE_EXPIRATION_TIMES[cacheType] * 1000) {
                return JSON.parse(cacheEntry.data);
            } else {
                await CacheModel.deleteOne({ key: `${cacheType}:${key}` });
            }
        }
    } catch (error) {
        logger.error(`Error loading cache from MongoDB: ${error}`);
    }
    return null;
}


async function saveCache(cacheType: string, key: string, data: any): Promise<void> {
    try {
        const cacheEntry = {
            key: `${cacheType}:${key}`,
            data: JSON.stringify(data),
            timestamp: Date.now(),
        };
        await CacheModel.updateOne({ key: cacheEntry.key }, { $set: cacheEntry }, { upsert: true });
    } catch (error) {
        logger.error(`Error saving cache to MongoDB: ${error}`);
    }
}

export { loadCache, saveCache, CACHE_EXPIRATION_TIMES };