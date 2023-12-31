import express from 'express'
import dotenv from 'dotenv'
import 'reflect-metadata'
import { connectToMongoDB } from '@configs/mongodb.config'
import { createGraphQLServer } from '@configs/graphQL.config'
import { graphqlUploadExpress } from 'graphql-upload'

dotenv.config()

async function server() {

    const app = express()
    app.use(express.json())
    app.use(graphqlUploadExpress());

    await connectToMongoDB()
    const server = await createGraphQLServer()
    await server.start()
    server.applyMiddleware({ app })

    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => {
        console.log('Server running on port: ', PORT)
    })
}

server()