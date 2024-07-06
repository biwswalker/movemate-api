import client from 'prom-client'
import express from 'express'

const collectDefaultMetrics = client.collectDefaultMetrics
collectDefaultMetrics()

const register = client.register

const requestCounter = new client.Counter({
    name: 'node_request_count',
    help: ' The number of requests made to the application',
    labelNames: ['method', 'route', 'status']
})

const redisHitCounter = new client.Counter({
    name: 'node_redis_cache_hit_count',
    help: 'The number of cache hits in Redis',
});

const redisMissCounter = new client.Counter({
    name: 'node_redis_cache_miss_count',
    help: 'The number of cache misses in Redis',
});

const requestDuration = new client.Histogram({
    name: 'node_request_duration_seconds',
    help: 'The duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
});

const app = express()

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

export {
    requestCounter,
    redisHitCounter,
    redisMissCounter,
    requestDuration,
};