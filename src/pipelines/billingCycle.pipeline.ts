import { GetBillingCycleArgs } from '@inputs/billingCycle.input'
import { EBillingStatus } from '@models/billingCycle.model'
import { get, isEmpty } from 'lodash'
import { PipelineStage } from 'mongoose'

export const BILLING_CYCLE_LIST = (
  {
    status,
    billingNumber,
    shipmentNumber,
    customerName,
    paymentMethod,
    receiptNumber,
    billedDate,
    issueDate,
    receiptDate,
  }: GetBillingCycleArgs,
  sort = {},
) => {
  const statusFilter =
    status === 'all'
      ? [
          EBillingStatus.VERIFY,
          EBillingStatus.CURRENT,
          EBillingStatus.OVERDUE,
          EBillingStatus.PAID,
          EBillingStatus.REFUND,
          EBillingStatus.REFUNDED,
        ]
      : [status]

  const customerNameMatch = customerName
    ? [
        {
          $match: {
            $or: [
              { 'user.individualDetail.firstname': { $regex: customerName, $options: 'i' } },
              { 'user.individualDetail.lastname': { $regex: customerName, $options: 'i' } },
              { 'user.businessDetail.businessName': { $regex: customerName, $options: 'i' } },
            ],
          },
        },
      ]
    : []

  const startBilledDateRaw = get(billedDate, '0', '')
  const endBilledDateRaw = get(billedDate, '1', '')
  const startBilledDate = startBilledDateRaw ? new Date(new Date(startBilledDateRaw).setHours(0, 0, 0, 0)) : null
  const endBilledDate = endBilledDateRaw ? new Date(new Date(endBilledDateRaw).setHours(23, 59, 59, 999)) : null

  const startIssueDateRaw = get(issueDate, '0', '')
  const endIssueDateRaw = get(issueDate, '1', '')
  const startIssueDate = startIssueDateRaw ? new Date(new Date(startIssueDateRaw).setHours(0, 0, 0, 0)) : null
  const endIssueDate = endIssueDateRaw ? new Date(new Date(endIssueDateRaw).setHours(23, 59, 59, 999)) : null

  const startReceiptDateRaw = get(receiptDate, '0', '')
  const endReceiptDateRaw = get(receiptDate, '1', '')
  const startReceiptDate = startReceiptDateRaw ? new Date(new Date(startReceiptDateRaw).setHours(0, 0, 0, 0)) : null
  const endReceiptDate = endReceiptDateRaw ? new Date(new Date(endReceiptDateRaw).setHours(23, 59, 59, 999)) : null

  const query: PipelineStage[] = [
    ...customerNameMatch,
    {
      $match: {
        ...(shipmentNumber ? { 'shipments.trackingNumber': { $regex: shipmentNumber, $options: 'i' } } : {}),
        ...(billingNumber ? { billingNumber: { $regex: billingNumber, $options: 'i' } } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(receiptNumber ? { 'receipt.receiptNumber': { $regex: receiptNumber, $options: 'i' } } : {}),
        ...(startIssueDate || endIssueDate
          ? {
              createdAt: {
                ...(startIssueDate ? { $gte: startIssueDate } : {}),
                ...(endIssueDate ? { $lte: endIssueDate } : {}),
              },
            }
          : {}),
        ...(!isEmpty(statusFilter) ? { billingStatus: { $in: statusFilter } } : {}),
      },
    },
    {
      $addFields: {
        statusWeight: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: ['$billingStatus', EBillingStatus.VERIFY],
                },
                then: 0,
              },
              {
                case: {
                  $eq: ['$billingStatus', EBillingStatus.REFUND],
                },
                then: 1,
              },
              {
                case: {
                  $eq: ['$billingStatus', EBillingStatus.OVERDUE],
                },
                then: 2,
              },
            ],
            default: 3,
          },
        },
      },
    },
    {
      $sort: {
        statusWeight: 1,
        ...sort,
      },
    },
  ]

  return [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
        pipeline: [
          {
            $lookup: {
              from: 'individualcustomers',
              localField: 'individualDetail',
              foreignField: '_id',
              as: 'individualDetail',
            },
          },
          {
            $unwind: {
              path: '$individualDetail',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'businesscustomers',
              localField: 'businessDetail',
              foreignField: '_id',
              as: 'businessDetail',
            },
          },
          {
            $unwind: {
              path: '$businessDetail',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'billingpayments',
        localField: 'billingPayment',
        foreignField: '_id',
        as: 'billingPayment',
      },
    },
    {
      $unwind: {
        path: '$billingPayment',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'billingreceipts',
        localField: 'billingReceipt',
        foreignField: '_id',
        as: 'billingReceipt',
      },
    },
    {
      $unwind: {
        path: '$billingReceipt',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'shipments',
        localField: 'shipments',
        foreignField: '_id',
        as: 'shipments',
      },
    },
    {
      $unwind: {
        path: '$billingReceipt',
        preserveNullAndEmptyArrays: true,
      },
    },
    ...query,
  ]
}
