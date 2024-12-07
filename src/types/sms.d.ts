type TThaiBulkCreditType = 'standard' | 'corporate'

interface IThaiBulkSMSRequest {
  msisdn: string
  message: string
  sender?: string
  force?: TThaiBulkCreditType
  scheduled_delivery?: string
  Shorten_url?: boolean
}

interface IPhoneNumber {
  number: string
  message_id: string
  used_credit: number
}

interface IBadPhoneNumber {
  message: string
  number: string
}

interface IThaiBulkSMSResponse {
  remaining_credit: number
  totalUse_credit: number
  credit_type: TThaiBulkCreditType
  phone_number_list: IPhoneNumber[]
  bad_phone_number_list: IBadPhoneNumber[]
}

interface IThaiBulkErrorResponse {
  code: number
  name: string
  description: string
}