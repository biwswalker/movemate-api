import { EUserRole, EUserType } from '@enums/users'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from '@models/customerBusinessCreditPayment.model'
import UserModel from '@models/user.model'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { get, sum } from 'lodash'
import { ClientSession, Types } from 'mongoose'

export async function updateCustomerCreditUsageBalance(customerId: string, amount: number, session?: ClientSession) {
  const _customer = await UserModel.findOne({
    _id: new Types.ObjectId(customerId),
    userRole: EUserRole.CUSTOMER,
    userType: EUserType.BUSINESS,
  }).session(session)

  const creditPaymentDetail = get(_customer, 'businessDetail.creditPayment') as
    | BusinessCustomerCreditPayment
    | undefined

  if (!_customer || !creditPaymentDetail) {
    return
  }

  const outstandingBalance = creditPaymentDetail.creditOutstandingBalance || 0
  const creditUsage = creditPaymentDetail.creditUsage || 0
  const newBalance = sum([outstandingBalance, amount])
  const newCreditUsage = sum([creditUsage, amount])
  await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(
    creditPaymentDetail._id,
    { creditOutstandingBalance: newBalance, creditUsage: newCreditUsage },
    { session },
  )
}

export async function addCustomerCreditUsage(customerId: string, amount: number, session?: ClientSession) {
  const _customer = await UserModel.findOne({
    _id: new Types.ObjectId(customerId),
    userRole: EUserRole.CUSTOMER,
    userType: EUserType.BUSINESS,
  }).session(session)

  const creditPaymentDetail = get(_customer, 'businessDetail.creditPayment') as
    | BusinessCustomerCreditPayment
    | undefined

  if (!_customer || !creditPaymentDetail) {
    const message = 'ไม่สามารถทำธุระกรรมได้'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] },
    })
  }

  const creditLimit = creditPaymentDetail.creditLimit || 0
  const creditUsage = creditPaymentDetail.creditUsage || 0
  const newCreditUsage = sum([creditUsage, amount])

  if (newCreditUsage > creditLimit) {
    const message = `วงเงินไม่พอ`
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.INSUFFICIENT_FUNDS, errors: [{ message }] },
    })
  }

  await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(
    creditPaymentDetail._id,
    { creditUsage: newCreditUsage },
    { session },
  )
}
