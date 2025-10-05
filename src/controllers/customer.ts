import { EBillingStatus } from '@enums/billing'
import { EPaymentMethod } from '@enums/payments'
import { EShipmentStatus } from '@enums/shipments'
import { EUserRole, EUserType } from '@enums/users'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from '@models/customerBusinessCreditPayment.model'
import BillingModel from '@models/finance/billing.model'
import { Quotation } from '@models/finance/quotation.model'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { get, last, sortBy, sum, sumBy } from 'lodash'
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

export async function recalculateCustomerCredit(customerId: string, session?: ClientSession) {
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

  const _billed = await BillingModel.find({
    user: customerId,
    status: { $in: [EBillingStatus.PENDING, EBillingStatus.VERIFY] },
  }).session(session)

  const _latestBilling = await BillingModel.findOne({ user: customerId }).sort({ issueDate: -1 }).session(session)

  const _lastBilledDate = _latestBilling ? _latestBilling.issueDate : new Date(0) // If no billing, use a very old date

  const _billedShipmentIds = await BillingModel.find({
    user: customerId,
    status: { $in: [EBillingStatus.PENDING, EBillingStatus.VERIFY, EBillingStatus.COMPLETE] },
  })
    .distinct('shipments')
    .session(session)

  const _unbilledShipments = await ShipmentModel.find({
    customer: customerId,
    paymentMethod: EPaymentMethod.CREDIT,
    _id: { $nin: _billedShipmentIds },
    $or: [
      { status: EShipmentStatus.DELIVERED },
      {
        status: EShipmentStatus.CANCELLED,
        cancellationFee: { $gt: 0 },
        cancelledDate: { $gt: _lastBilledDate },
      },
    ],
  }).session(session)

  let unbilledAmount = 0
  for (const shipment of _unbilledShipments) {
    if (shipment.status === EShipmentStatus.DELIVERED) {
      const latestQuotation = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined
      if (latestQuotation) {
        unbilledAmount += latestQuotation.price.total
      }
    } else if (shipment.status === EShipmentStatus.CANCELLED) {
      unbilledAmount += shipment.cancellationFee
    }
  }

  const outstandingBillings = sumBy(_billed, 'amount.total')
  const creditUsage = outstandingBillings + unbilledAmount

  await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(
    creditPaymentDetail._id,
    { creditOutstandingBalance: outstandingBillings, creditUsage: creditUsage },
    { session },
  )
}
