declare namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV: 'development' | 'production'
        PORT: string
        JWT_SECRET: string
        DATABASE_URL: string
        DATABASE_NAME: string
        MAP_API_KEY: string
        DOMAINNAME: string
    }
}