declare namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV: 'development' | 'production'
        API_PORT: string
        JWT_SECRET: string
        MOVEMATE_SHARED_KEY: string
        DATABASE_URL: string
        DATABASE_NAME: string
        NOREPLY_EMAIL: string
        NOREPLY_SECRET: string
        GOOGLE_MAP_API_KEY: string
        GOOGLE_SERVICE_ID: string
        GOOGLE_CLIENT_ID: string
        GOOGLE_CLIENT_SECERT: string
        REDIS_HOST: string
        REDIS_PORT: string
        REDIS_PASSWORD: string
    }
}