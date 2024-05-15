import express from 'express'
import dotenv from 'dotenv'
import { engine } from 'express-handlebars'
import 'reflect-metadata'
import { connectToMongoDB } from '@configs/mongodb.config'
import { createGraphQLServer } from '@configs/graphQL.config'
import { authenticateTokenAccessImage } from '@guards/auth.guards'
import initialGoogleOAuth from '@configs/google.config'
import api_v1 from '@apis/v1'
import { graphqlUploadExpress } from 'graphql-upload-ts'
import bodyParser from 'body-parser'

dotenv.config()

const MaxUploadFileSize = 2 * 1024 * 1024

async function server() {

    const app = express()
    app.use(express.json())
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(graphqlUploadExpress({ maxFiles: 4, maxFileSize: MaxUploadFileSize }))
    app.use('/source', authenticateTokenAccessImage, express.static('uploads'))
    app.use('/assets', express.static('assets'))

    app.engine('hbs', engine({ extname: '.hbs', defaultLayout: false }))
    app.set('view engine', 'hbs')

    await connectToMongoDB()
    const server = await createGraphQLServer()
    await server.start()
    server.applyMiddleware({ app })
    await initialGoogleOAuth()

    app.use('/api/v1', api_v1)

    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => {
        console.log('Server running on port: ', PORT)
    })
}

server()