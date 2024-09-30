import express from 'express'
import dotenv from 'dotenv'
import { engine } from 'express-handlebars'
import { Request } from 'express'
import { expressMiddleware } from '@apollo/server/express4'
import { connectToMongoDB } from '@configs/mongodb.config'
import { createGraphQLServer } from '@configs/graphQL.config'
import { authenticateTokenAccessImage } from '@guards/auth.guards'
import { graphqlUploadExpress } from 'graphql-upload-ts'
import api_v1 from '@apis/v1'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import cors from 'cors'
import http from 'http'
import 'reflect-metadata'
import { get } from 'lodash'
import configureCronjob from '@configs/cronjob'
import { initializeFirebase } from '@configs/firebase'
import { verifyAccessToken } from '@utils/auth.utils'
import pubsub from '@configs/pubsub'

morgan.token('graphql-query', (req: Request) => {
  const operationName = get(req, 'body.operationName', '')
  const variables = get(req, 'body.variables', {})
  return `${operationName} ${JSON.stringify(variables)}`
})

dotenv.config()
const MaxUploadFileSize = 2 * 1024 * 1024

async function server() {
  const app = express()
  const httpServer = http.createServer(app)

  // const environment = process.env.NODE_ENV
  const alllowedCors = cors<cors.CorsRequest>({
    maxAge: 600,
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    origin: '*',
    // [
    //   'https://movematethailand.com',
    //   'https://www.movematethailand.com',
    //   'https://admin.movematethailand.com',
    //   'http://localhost:3000',
    //   'http://localhost:3001',
    // ],
  })
  app.use(alllowedCors)
  app.use(express.json({ limit: '10mb' }))
  app.use(morgan(':method :url :graphql-query'))
  app.use(bodyParser.urlencoded({ extended: false }))
  // app.use(graphqlUploadExpress({ maxFiles: 4, maxFileSize: MaxUploadFileSize }))
  app.use('/source', authenticateTokenAccessImage, express.static('uploads'))
  app.use('/invoice', authenticateTokenAccessImage, express.static('generated/invoice'))
  app.use('/receipt', authenticateTokenAccessImage, express.static('generated/receipt'))

  app.engine('hbs', engine({ extname: '.hbs', defaultLayout: false }))
  app.set('view engine', 'hbs')
  app.set('trust proxy', true)

  // GrapQL Server
  const server = await createGraphQLServer(httpServer)

  await connectToMongoDB()
  await server.start()

  app.use(
    '/graphql',
    alllowedCors,
    express.json({ limit: '10mb' }),
    graphqlUploadExpress({ maxFiles: 4, maxFileSize: MaxUploadFileSize }),
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        const clientIp: string = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
        try {
          console.log('x-forwarded-for: ', clientIp)
          const authorization = get(req, 'headers.authorization', '')
          const token = authorization.split(' ')[1]
          if (token) {
            const decodedToken = verifyAccessToken(token)
            if (decodedToken) {
              const user_id = decodedToken.user_id
              const user_role = decodedToken.user_role
              req.user_id = user_id
              req.user_role = user_role
              return { req, res, ip: clientIp, user_id, user_role, pubsub }
            }
          }
          return { req, res, ip: clientIp, pubsub }
        } catch (error) {
          console.log('expressMiddleware.context error: ', error)
          return { req, res, ip: clientIp, pubsub }
        }
      },
    }),
  )
  app.use('/api/v1', api_v1)
  
  const PORT = process.env.API_PORT || 5000

  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve))
  console.log(`🚀 Server ready at :`, httpServer.address())

  // Set timezone
  configureCronjob()
  initializeFirebase()
}

server()
