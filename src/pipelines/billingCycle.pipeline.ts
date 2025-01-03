import { EBillingCriteriaState, EBillingCriteriaStatus, EBillingState, EBillingStatus } from '@enums/billing'
import { GetBillingInput } from '@inputs/billingCycle.input'
import { get, isEmpty } from 'lodash'
import { PipelineStage, Types } from 'mongoose'
import { pipeline } from 'nodemailer/lib/xoauth2'

export const BILLING_CYCLE_LIST = (data: GetBillingInput, sort = {}, project = {}) => {
  const {
    status,
    state,
    billingNumber,
    shipmentNumber,
    customerName,
    paymentMethod,
    receiptNumber,
    billedDate,
    issueDate,
    receiptDate,
    customerId,
  } = data
  const statusFilter = status !== EBillingCriteriaStatus.ALL ? [status] : []
  const stateFilter = state && state !== EBillingCriteriaState.ALL ? [state] : []

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

  const beforeMatch: PipelineStage[] = [
    ...(customerId
      ? [
          {
            $match: {
              user: new Types.ObjectId(customerId),
            },
          },
        ]
      : []),
  ]

  const query: PipelineStage[] = [
    ...customerNameMatch,
    {
      $match: {
        ...(shipmentNumber ? { 'shipments.trackingNumber': { $regex: shipmentNumber, $options: 'i' } } : {}),
        ...(billingNumber ? { billingNumber: { $regex: billingNumber, $options: 'i' } } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(receiptNumber ? { 'receipts.receiptNumber': { $regex: receiptNumber, $options: 'i' } } : {}),
        ...(startIssueDate || endIssueDate
          ? {
              createdAt: {
                ...(startIssueDate ? { $gte: startIssueDate } : {}),
                ...(endIssueDate ? { $lte: endIssueDate } : {}),
              },
            }
          : {}),
        ...(!isEmpty(statusFilter) ? { status: { $in: statusFilter } } : {}),
        ...(!isEmpty(stateFilter) ? { state: { $in: stateFilter } } : {}),
      },
    },
    {
      $addFields: {
        statusWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', EBillingStatus.VERIFY] }, then: 0 },
              { case: { $eq: ['$status', EBillingStatus.PENDING] }, then: 1 },
              { case: { $eq: ['$status', EBillingStatus.COMPLETE] }, then: 2 },
              { case: { $eq: ['$status', EBillingStatus.CANCELLED] }, then: 3 },
            ],
            default: 4,
          },
        },
        stateWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$state', EBillingState.REFUND] }, then: 0 },
              { case: { $eq: ['$state', EBillingState.OVERDUE] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    {
      $sort: {
        statusWeight: 1,
        stateWeight: 1,
        ...sort,
      },
    },
  ]

  const projects: PipelineStage[] = !isEmpty(project) ? [{ $project: project as any }] : []

  return [
    ...beforeMatch,
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
          {
            $lookup: {
              from: 'files',
              localField: 'profileImage',
              foreignField: '_id',
              as: 'profileImage',
            },
          },
          {
            $unwind: {
              path: '$profileImage',
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
        from: 'payments',
        localField: 'payments',
        foreignField: '_id',
        as: 'payments',
        pipeline: [
          {
            $lookup: {
              from: 'paymentevidences',
              localField: 'evidence',
              foreignField: '_id',
              as: 'evidence',
              pipeline: [
                {
                  $lookup: {
                    from: 'files',
                    localField: 'image',
                    foreignField: '_id',
                    as: 'image',
                  },
                },
                {
                  $unwind: {
                    path: '$image',
                    preserveNullAndEmptyArrays: true,
                  },
                },
              ],
            },
          },
          {
            $lookup: {
              from: 'quotations',
              localField: 'quotations',
              foreignField: '_id',
              as: 'quotations',
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'receipts',
        localField: 'receipts',
        foreignField: '_id',
        as: 'receipts',
      },
    },
    {
      $lookup: {
        from: 'invoice',
        localField: 'invoice',
        foreignField: '_id',
        as: 'invoice',
      },
    },
    {
      $unwind: {
        path: '$invoice',
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
      $lookup: {
        from: 'billingadjustmentnotes',
        localField: 'adjustmentNotes',
        foreignField: '_id',
        as: 'adjustmentNotes',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'updatedBy',
        foreignField: '_id',
        as: 'updatedBy',
      },
    },
    {
      $unwind: {
        path: '$updatedBy',
        preserveNullAndEmptyArrays: true,
      },
    },
    ...query,
    ...projects,
  ]
}
