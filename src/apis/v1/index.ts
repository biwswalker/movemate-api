import { Router } from 'express'
import email_api from './email.api'

const api_v1 = Router()

api_v1.use('/email', email_api)

export default api_v1