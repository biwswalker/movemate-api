import {
  EBillingCriteriaState,
  EBillingCriteriaStatus,
  EBillingState,
  ECreditDisplayStatus,
  EDisplayStatus,
  EReceiptType,
} from '@enums/billing'
import { GetBillingInput } from '@inputs/billingCycle.input'
import { get, isEmpty } from 'lodash'
import { FilterQuery, PipelineStage, Types } from 'mongoose'
import { userPipelineStage } from './user.pipeline'
import { filePipelineStage } from './file.pipline'
import { billingDocumentPipelineStage } from './document.pipeline'
import { endOfDay, startOfDay } from 'date-fns'
import { EUserCriterialType, EUserType } from '@enums/users'
import { EAdminAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import { EPaymentMethod } from '@enums/payments'

export const BILLING_CYCLE_LIST = (
  data: GetBillingInput,
  sort: any | undefined = {},
  project = {},
): PipelineStage[] => {
  const {
    status,
    state,
    userType,
    billingNumber,
    shipmentNumber,
    customerName,
    paymentMethod,
    receiptNumber,
    billedDate,
    issueDate,
    receiptDate,
    customerId,
    cashStatuses,
    creditStatuses,
    displayStatus,
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
        ...(userType && userType !== EUserCriterialType.ALL ? { 'user.userType': userType } : {}),
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
        // statusWeight: {
        //   $switch: {
        //     branches: [
        //       { case: { $eq: ['$status', EBillingStatus.VERIFY] }, then: 0 },
        //       { case: { $eq: ['$status', EBillingStatus.PENDING] }, then: 1 },
        //       { case: { $eq: ['$status', EBillingStatus.COMPLETE] }, then: 2 },
        //       { case: { $eq: ['$status', EBillingStatus.CANCELLED] }, then: 3 },
        //     ],
        //     default: 4,
        //   },
        // },
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
      $addFields: {
        displayStatusInfo: {
          $let: {
            vars: {
              now: new Date(),
              shipment: { $arrayElemAt: ['$shipments', 0] },
              lastFinalReceipt: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                    },
                  },
                  -1, // เอาใบสุดท้าย
                ],
              },

              lastFinalReceiptWithWHT: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: {
                        $and: [
                          { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                          { $gt: ['$$receipt.document.receviedWHTDocumentDate', null] },
                        ],
                      },
                    },
                  },
                  -1,
                ],
              },
              // หาว่ามีใบเสร็จใดๆ อยู่ในระบบหรือไม่
              hasAnyReceipt: { $gt: [{ $size: '$receipts' }, 0] },
            },
            in: {
              // ตรวจสอบว่าเป็น CREDIT หรือ CASH
              $cond: {
                if: { $eq: ['$paymentMethod', EPaymentMethod.CREDIT] },
                // --- Logic สำหรับ CREDIT ---
                then: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $lt: ['$paymentDueDate', '$$now'] }, // เลยวันครบกำหนด
                            { $ne: ['$status', 'COMPLETE'] }, // และยังไม่ชำระ
                          ],
                        },
                        then: { status: ECreditDisplayStatus.OVERDUE, name: 'ค้างชำระ', weight: 3 },
                      },
                      // 2. ได้รับหัก ณ ที่จ่าย
                      {
                        case: { $ne: ['$$lastFinalReceiptWithWHT', null] },
                        then: { status: ECreditDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 2 },
                      },
                      // 3. ชำระแล้ว (มีใบเสร็จ แต่ยังไม่ได้รับ WHT)
                      {
                        case: { $eq: ['$$hasAnyReceipt', true] },
                        then: { status: ECreditDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 1 },
                      },
                    ],
                    // 4. อยู่ในรอบชำระ (Default)
                    default: { status: ECreditDisplayStatus.IN_CYCLE, name: 'อยู่ในรอบชำระ', weight: 0 },
                  },
                },
                // --- Logic สำหรับ CASH ---
                else: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            // สำหรับงานเงินสด สถานะเริ่มต้นคือ IDLE และรอ Admin ตรวจสอบ
                            { $eq: ['$$shipment.status', EShipmentStatus.IDLE] },
                            { $eq: ['$$shipment.adminAcceptanceStatus', EAdminAcceptanceStatus.PENDING] },
                          ],
                        },
                        then: { status: EDisplayStatus.AWAITING_VERIFICATION, name: 'รอตรวจสอบ', weight: -1 }, // weight น้อยสุดเพื่อให้อยู่บนสุด
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.CANCELLED] },
                        then: { status: EDisplayStatus.REFUNDED, name: 'คืนเงินแล้ว', weight: 2 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.REFUND] },
                        then: { status: EDisplayStatus.CANCELLED, name: 'ยกเลิกงาน', weight: 1 },
                      },
                      {
                        case: { $in: ['$$shipment.status', [EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING]] },
                        then: { status: EDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 0 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.DELIVERED] },
                        then: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$user.userType', EUserType.BUSINESS] },
                                { $gt: ['$$lastFinalReceipt.document.receivedWHTDocumentDate', null] },
                                { $ne: ['$$lastFinalReceipt.document.documentNumber', null] },
                              ],
                            },
                            then: { status: EDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 4 },
                            else: { status: EDisplayStatus.BILLED, name: 'ออกใบเสร็จ', weight: 3 },
                          },
                        },
                      },
                    ],
                    default: { status: EDisplayStatus.NONE, name: 'ไม่ระบุ', weight: 99 },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        displayStatus: '$displayStatusInfo.status',
        displayStatusName: '$displayStatusInfo.name',
        statusWeight: '$displayStatusInfo.weight',
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
        displayStatus: 1,
        displayStatusName: 1,
        paymentMethod: 1,
        userId: '$user._id',
        userType: '$user.userType',
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
            else: { $concat: ['$user.individualDetail.firstname', ' ', '$user.individualDetail.lastname'] },
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
        invoiceNumber: '$invoice.invoiceNumber',
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

  const postQuery: FilterQuery<any> = {
    ...(startReceiptDate || endReceiptDate
      ? {
          latestReceiptDate: {
            ...(startReceiptDate ? { $gte: startReceiptDate } : {}),
            ...(endReceiptDate ? { $lte: endReceiptDate } : {}),
          },
        }
      : {}),
    ...(paymentMethod === EPaymentMethod.CASH && !isEmpty(cashStatuses)
      ? { displayStatus: { $in: cashStatuses } }
      : {}),
    ...(paymentMethod === EPaymentMethod.CREDIT && !isEmpty(creditStatuses)
      ? { displayStatus: { $in: creditStatuses } }
      : {}),
    ...(isEmpty(displayStatus) ? { displayStatus: { $in: displayStatus } } : {}),
  }

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
    {
      $sort: {
        statusWeight: 1,
        stateWeight: 1,
        createdAt: -1,
      },
    },
    ...projects,
    ...(!isEmpty(postQuery) ? [{ $match: postQuery }] : []),
    ...(!isEmpty(sort) ? [{ $sort: sort }] : []),
  ]
}

export const GET_BILLING_STATUS_BY_BILLING_NUMBER = (billingNumber: string): PipelineStage[] => {
  return [
    { $match: { billingNumber } },
    {
      $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' },
    },
    { $unwind: '$user' },
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
        from: 'receipts',
        localField: 'receipts',
        foreignField: '_id',
        as: 'receipts',
        pipeline: [
          {
            $lookup: { from: 'billingdocuments', localField: 'document', foreignField: '_id', as: 'document' },
          },
          { $unwind: { path: '$document', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    {
      $addFields: {
        displayStatusInfo: {
          $let: {
            vars: {
              now: new Date(),
              shipment: { $arrayElemAt: ['$shipments', 0] },
              lastFinalReceipt: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                    },
                  },
                  -1, // เอาใบสุดท้าย
                ],
              },

              lastFinalReceiptWithWHT: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: {
                        $and: [
                          { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                          { $gt: ['$$receipt.document.receviedWHTDocumentDate', null] },
                        ],
                      },
                    },
                  },
                  -1,
                ],
              },
              // หาว่ามีใบเสร็จใดๆ อยู่ในระบบหรือไม่
              hasAnyReceipt: { $gt: [{ $size: '$receipts' }, 0] },
            },
            in: {
              // ตรวจสอบว่าเป็น CREDIT หรือ CASH
              $cond: {
                if: { $eq: ['$paymentMethod', EPaymentMethod.CREDIT] },
                // --- Logic สำหรับ CREDIT ---
                then: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $lt: ['$paymentDueDate', '$$now'] }, // เลยวันครบกำหนด
                            { $ne: ['$status', 'COMPLETE'] }, // และยังไม่ชำระ
                          ],
                        },
                        then: { status: ECreditDisplayStatus.OVERDUE, name: 'ค้างชำระ', weight: 3 },
                      },
                      // 2. ได้รับหัก ณ ที่จ่าย
                      {
                        case: { $ne: ['$$lastFinalReceiptWithWHT', null] },
                        then: { status: ECreditDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 2 },
                      },
                      // 3. ชำระแล้ว (มีใบเสร็จ แต่ยังไม่ได้รับ WHT)
                      {
                        case: { $eq: ['$$hasAnyReceipt', true] },
                        then: { status: ECreditDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 1 },
                      },
                    ],
                    // 4. อยู่ในรอบชำระ (Default)
                    default: { status: ECreditDisplayStatus.IN_CYCLE, name: 'อยู่ในรอบชำระ', weight: 0 },
                  },
                },
                // --- Logic สำหรับ CASH ---
                else: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            // สำหรับงานเงินสด สถานะเริ่มต้นคือ IDLE และรอ Admin ตรวจสอบ
                            { $eq: ['$$shipment.status', EShipmentStatus.IDLE] },
                            { $eq: ['$$shipment.adminAcceptanceStatus', EAdminAcceptanceStatus.PENDING] },
                          ],
                        },
                        then: { status: EDisplayStatus.AWAITING_VERIFICATION, name: 'รอตรวจสอบ', weight: -1 }, // weight น้อยสุดเพื่อให้อยู่บนสุด
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.CANCELLED] },
                        then: { status: EDisplayStatus.REFUNDED, name: 'คืนเงินแล้ว', weight: 2 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.REFUND] },
                        then: { status: EDisplayStatus.CANCELLED, name: 'ยกเลิกงาน', weight: 1 },
                      },
                      {
                        case: { $in: ['$$shipment.status', [EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING]] },
                        then: { status: EDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 0 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.DELIVERED] },
                        then: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$user.userType', EUserType.BUSINESS] },
                                { $gt: ['$$lastFinalReceipt.document.receivedWHTDocumentDate', null] },
                                { $ne: ['$$lastFinalReceipt.document.documentNumber', null] },
                              ],
                            },
                            then: { status: EDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 4 },
                            else: { status: EDisplayStatus.BILLED, name: 'ออกใบเสร็จ', weight: 3 },
                          },
                        },
                      },
                    ],
                    default: { status: EDisplayStatus.NONE, name: 'ไม่ระบุ', weight: 99 },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        billingId: '$_id',
        status: '$displayStatusInfo.status',
        statusName: '$displayStatusInfo.name',
        paymentMethod: '$paymentMethod',
      },
    },
  ]
}

export const AGGREGATE_BILLING_STATUS_COUNT = (paymentMethod: EPaymentMethod, customerId?: string): PipelineStage[] => {
  const initialMatch: any = { paymentMethod }
  if (customerId) {
    initialMatch.user = new Types.ObjectId(customerId)
  }

  const displayStatusLogic: PipelineStage[] = [
    {
      $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' },
    },
    { $unwind: '$user' },
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
        from: 'receipts',
        localField: 'receipts',
        foreignField: '_id',
        as: 'receipts',
        pipeline: [
          {
            $lookup: { from: 'billingdocuments', localField: 'document', foreignField: '_id', as: 'document' },
          },
          { $unwind: { path: '$document', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    {
      $addFields: {
        displayStatusInfo: {
          $let: {
            vars: {
              now: new Date(),
              shipment: { $arrayElemAt: ['$shipments', 0] },
              lastFinalReceipt: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                    },
                  },
                  -1, // เอาใบสุดท้าย
                ],
              },

              lastFinalReceiptWithWHT: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$receipts',
                      as: 'receipt',
                      cond: {
                        $and: [
                          { $eq: ['$$receipt.receiptType', EReceiptType.FINAL] },
                          { $gt: ['$$receipt.document.receviedWHTDocumentDate', null] },
                        ],
                      },
                    },
                  },
                  -1,
                ],
              },
              // หาว่ามีใบเสร็จใดๆ อยู่ในระบบหรือไม่
              hasAnyReceipt: { $gt: [{ $size: '$receipts' }, 0] },
            },
            in: {
              // ตรวจสอบว่าเป็น CREDIT หรือ CASH
              $cond: {
                if: { $eq: ['$paymentMethod', EPaymentMethod.CREDIT] },
                // --- Logic สำหรับ CREDIT ---
                then: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $lt: ['$paymentDueDate', '$$now'] }, // เลยวันครบกำหนด
                            { $ne: ['$status', 'COMPLETE'] }, // และยังไม่ชำระ
                          ],
                        },
                        then: { status: ECreditDisplayStatus.OVERDUE, name: 'ค้างชำระ', weight: 3 },
                      },
                      // 2. ได้รับหัก ณ ที่จ่าย
                      {
                        case: { $ne: ['$$lastFinalReceiptWithWHT', null] },
                        then: { status: ECreditDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 2 },
                      },
                      // 3. ชำระแล้ว (มีใบเสร็จ แต่ยังไม่ได้รับ WHT)
                      {
                        case: { $eq: ['$$hasAnyReceipt', true] },
                        then: { status: ECreditDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 1 },
                      },
                    ],
                    // 4. อยู่ในรอบชำระ (Default)
                    default: { status: ECreditDisplayStatus.IN_CYCLE, name: 'อยู่ในรอบชำระ', weight: 0 },
                  },
                },
                // --- Logic สำหรับ CASH ---
                else: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            // สำหรับงานเงินสด สถานะเริ่มต้นคือ IDLE และรอ Admin ตรวจสอบ
                            { $eq: ['$$shipment.status', EShipmentStatus.IDLE] },
                            { $eq: ['$$shipment.adminAcceptanceStatus', EAdminAcceptanceStatus.PENDING] },
                          ],
                        },
                        then: { status: EDisplayStatus.AWAITING_VERIFICATION, name: 'รอตรวจสอบ', weight: -1 }, // weight น้อยสุดเพื่อให้อยู่บนสุด
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.CANCELLED] },
                        then: { status: EDisplayStatus.REFUNDED, name: 'คืนเงินแล้ว', weight: 2 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.REFUND] },
                        then: { status: EDisplayStatus.CANCELLED, name: 'ยกเลิกงาน', weight: 1 },
                      },
                      {
                        case: { $in: ['$$shipment.status', [EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING]] },
                        then: { status: EDisplayStatus.PAID, name: 'ชำระแล้ว', weight: 0 },
                      },
                      {
                        case: { $eq: ['$$shipment.status', EShipmentStatus.DELIVERED] },
                        then: {
                          $cond: {
                            if: {
                              $and: [
                                { $eq: ['$user.userType', EUserType.BUSINESS] },
                                { $gt: ['$$lastFinalReceipt.document.receivedWHTDocumentDate', null] },
                                { $ne: ['$$lastFinalReceipt.document.documentNumber', null] },
                              ],
                            },
                            then: { status: EDisplayStatus.WHT_RECEIVED, name: 'ได้รับหัก ณ ที่จ่าย', weight: 4 },
                            else: { status: EDisplayStatus.BILLED, name: 'ออกใบเสร็จ', weight: 3 },
                          },
                        },
                      },
                    ],
                    default: { status: EDisplayStatus.NONE, name: 'ไม่ระบุ', weight: 99 },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        displayStatus: '$displayStatusInfo.status',
      },
    },
  ]

  return [
    { $match: initialMatch },
    ...displayStatusLogic,
    {
      $group: {
        _id: '$displayStatus', // จัดกลุ่มตาม displayStatus ที่คำนวณได้
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        key: '$_id',
        count: 1,
      },
    },
  ]
}
