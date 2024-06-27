import { Router } from 'express'
import email_api from './email.api'
import ping_api from './ping.api'
import activate_api from './activate.api'

const api_v1 = Router()

api_v1.use('/email', email_api)
api_v1.use('/ping', ping_api)
api_v1.use('/activate', activate_api)

export default api_v1