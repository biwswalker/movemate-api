import { EBillingCriteriaState, EBillingCriteriaStatus, EBillingState, EBillingStatus } from '@enums/billing'
import { GetBillingInput } from '@inputs/billingCycle.input'
import { get, isEmpty } from 'lodash'
import { PipelineStage, Types } from 'mongoose'
import { userPipelineStage } from './user.pipeline'
import { filePipelineStage } from './file.pipline'
import { billingDocumentPipelineStage } from './document.pipeline'
import { endOfDay, startOfDay } from 'date-fns'

export const BILLING_CYCLE_LIST = (
  data: GetBillingInput,
  sort: any | undefined = {},
  project = {},
): PipelineStage[] => {
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

  const statusFilter = status && status !== EBillingCriteriaStatus.ALL ? [status] : []
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
  const startBilledDate = startBilledDateRaw ? startOfDay(startBilledDateRaw) : null
  const endBilledDate = endBilledDateRaw ? endOfDay(endBilledDateRaw) : null

  const startIssueDateRaw = get(issueDate, '0', '')
  const endIssueDateRaw = get(issueDate, '1', '')
  const startIssueDate = startIssueDateRaw ? startOfDay(startIssueDateRaw) : null
  const endIssueDate = endIssueDateRaw ? endOfDay(endIssueDateRaw) : null

  const startReceiptDateRaw = get(receiptDate, '0', '')
  const endReceiptDateRaw = get(receiptDate, '1', '')
  const startReceiptDate = startReceiptDateRaw ? startOfDay(startReceiptDateRaw) : null
  const endReceiptDate = endReceiptDateRaw ? endOfDay(endReceiptDateRaw) : null

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
  ]

  const optimizedProject: PipelineStage[] = [
    {
      $project: {
        _id: 1,
        billingNumber: 1,
        status: 1,
        state: 1,
        paymentMethod: 1,
        userTitle: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$user.userType', 'INDIVIDUAL'] },
                then: {
                  $cond: {
                    if: { $eq: ['$user.individualDetail.title', 'อื่นๆ'] },
                    then: '$user.individualDetail.otherTitle',
                    else: '$user.individualDetail.title',
                  },
                },
              },
              {
                case: { $eq: ['$user.userType', 'BUSINESS'] },
                then: '$user.businessDetail.businessTitle',
              },
            ],
            default: '',
          },
        },
        userFullname: {
          $cond: {
            if: { $eq: ['$user.userType', 'BUSINESS'] },
            then: '$user.businessDetail.businessName',
            else: { $concat: ['$user.individualDetail.firstname', ' ', '$customer.individualDetail.lastname'] },
          },
        },
        latestQuotationTax: {
          $let: {
            vars: {
              lastPayment: { $arrayElemAt: ['$payments', -1] },
            },
            in: {
              $let: {
                vars: {
                  lastQuotation: { $arrayElemAt: ['$$lastPayment.quotations', -1] },
                },
                in: '$$lastQuotation.price.tax',
              },
            },
          },
        },
        latestQuotationPrice: {
          $let: {
            vars: {
              lastPayment: { $arrayElemAt: ['$payments', -1] },
            },
            in: {
              $let: {
                vars: {
                  lastQuotation: { $arrayElemAt: ['$$lastPayment.quotations', -1] },
                },
                in: '$$lastQuotation.price.total',
              },
            },
          },
        },
        latestAmount: {
          $let: {
            vars: {
              lastPayment: { $arrayElemAt: ['$payments', -1] },
            },
            in: '$$lastPayment.total',
          },
        },
        latestPaymentStatus: {
          $let: {
            vars: {
              lastPayment: { $arrayElemAt: ['$payments', -1] },
            },
            in: '$$lastPayment.status',
          },
        },
        latestPaymentType: {
          $let: {
            vars: {
              lastPayment: { $arrayElemAt: ['$payments', -1] },
            },
            in: '$$lastPayment.type',
          },
        },
        createdAt: 1,
        receiptNumbers: {
          $reduce: {
            input: '$receipts.receiptNumber',
            initialValue: '',
            in: {
              $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this'],
            },
          },
        },
        latestReceiptDate: { $max: '$receipts.receiptDate' },
        latestPaymentDate: { $max: '$payments.createdAt' },
        adjustmentIncreaseNumbers: {
          $reduce: {
            input: {
              $filter: {
                input: '$adjustmentNotes',
                as: 'note',
                cond: { $eq: ['$$note.adjustmentType', 'DEBIT_NOTE'] },
              },
            },
            initialValue: '',
            in: {
              $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this.adjustmentNumber'],
            },
          },
        },
        adjustmentDecreaseNumbers: {
          $reduce: {
            input: {
              $filter: {
                input: '$adjustmentNotes',
                as: 'note',
                cond: { $eq: ['$$note.adjustmentType', 'CREDIT_NOTE'] },
              },
            },
            initialValue: '',
            in: {
              $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this.adjustmentNumber'],
            },
          },
        },
        billingStartDate: '$billingStartDate',
        billingEndDate: '$billingEndDate',
        invoiceDate: '$invoice.invoiceDate',
        paymentDueDate: '$paymentDueDate',
        invoicePostalStatus: {
          $cond: {
            if: { $and: ['$invoice.document.postalTime', '$invoice.document.trackingNumber'] },
            then: 'จัดส่งแล้ว',
            else: {
              $cond: {
                if: '$invoice.document.postalTime',
                then: 'จัดส่งแล้ว',
                else: '',
              },
            },
          },
        },
        invoiceFilename: '$invoice.document.filename',
        receiptFilenames: '$receipts.document.filename',
        invoiceTrackingNumber: '$invoice.document.trackingNumber',
        receiptTrackingNumbers: {
          $reduce: {
            input: '$receipts.document.trackingNumber',
            initialValue: '',
            in: {
              $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this'],
            },
          },
        },
      },
    },
  ]

  const postQuery: PipelineStage[] = [
    {
      $match: {
        ...(startReceiptDate || endReceiptDate
          ? {
              latestReceiptDate: {
                ...(startReceiptDate ? { $gte: startReceiptDate } : {}),
                ...(endReceiptDate ? { $lte: endReceiptDate } : {}),
              },
            }
          : {}),
      },
    },
  ]

  const projects: PipelineStage[] = !isEmpty(project) ? [{ $project: project as any }] : optimizedProject

  return [
    ...beforeMatch,
    ...userPipelineStage('user'),
    ...userPipelineStage('updatedBy'),
    {
      $lookup: {
        from: 'payments',
        localField: 'payments',
        foreignField: '_id',
        as: 'payments',
        pipeline: [
          { $sort: { createdAt: 1 } }, // Sort payments to get the latest
          {
            $lookup: {
              from: 'paymentevidences',
              localField: 'evidence',
              foreignField: '_id',
              as: 'evidence',
              pipeline: filePipelineStage('image'),
            },
          },
          {
            $lookup: {
              from: 'quotations',
              localField: 'quotations',
              foreignField: '_id',
              as: 'quotations',
              pipeline: [{ $sort: { createdAt: 1 } }, ...userPipelineStage('updatedBy')], // Sort quotations
            },
          },
          ...userPipelineStage('updatedBy'),
        ],
      },
    },
    {
      $lookup: {
        from: 'receipts',
        localField: 'receipts',
        foreignField: '_id',
        as: 'receipts',
        pipeline: billingDocumentPipelineStage('document'),
      },
    },
    {
      $lookup: {
        from: 'invoices',
        localField: 'invoice',
        foreignField: '_id',
        as: 'invoice',
        pipeline: [...billingDocumentPipelineStage('document'), ...userPipelineStage('updatedBy')],
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
        pipeline: [
          {
            $lookup: {
              from: 'billingdocuments',
              localField: 'document',
              foreignField: '_id',
              as: 'document',
            },
          },
          {
            $unwind: {
              path: '$document',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
      },
    },
    ...query,
    ...projects,
    ...postQuery,
    {
      $sort: {
        statusWeight: 1,
        stateWeight: 1,
        ...sort,
      },
    },
  ]
}
