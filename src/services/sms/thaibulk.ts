import axios, { AxiosResponse } from 'axios'
import { THAIBULK_CREDIT_API, THAIBULK_SMS_API } from './constants'

export async function sendSMS(request: IThaiBulkSMSRequest): Promise<IThaiBulkSMSResponse> {
  const authorizationToken = Buffer.from(
    `${process.env.THAIBULKSMS_API_KEY}:${process.env.THAIBULKSMS_API_SECRET}`,
  ).toString('base64')
  const response = await axios.post<any, AxiosResponse<IThaiBulkSMSResponse>>(
    THAIBULK_SMS_API,
    { ...request, sender: process.env.THAIBULKSMS_SENDER_NAME, force: process.env.THAIBULKSMS_CREDIT_TYPE },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        authorization: authorizationToken,
      },
      auth: {
        username: process.env.THAIBULKSMS_API_KEY,
        password: process.env.THAIBULKSMS_API_SECRET,
      },
    },
  )

  return response.data
}

export async function credit(): Promise<IThaiBulkSMSResponse> {
  const authorizationToken = Buffer.from(
    `${process.env.THAIBULKSMS_API_KEY}:${process.env.THAIBULKSMS_API_SECRET}`,
  ).toString('base64')
  const response = await axios.get<any, AxiosResponse<IThaiBulkSMSResponse>>(THAIBULK_CREDIT_API, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      authorization: authorizationToken,
    },
    auth: {
      username: process.env.THAIBULKSMS_API_KEY,
      password: process.env.THAIBULKSMS_API_SECRET,
    },
  })

  return response.data
}
