import { GetDriverTransactionArgs, GetDriverTransactionInput, GetTransactionsArgs } from '@inputs/transactions.input'
import { ERefType, ETransactionOwner, ETransactionStatus, ETransactionType } from '@models/transaction.model'
import { includes, isEmpty } from 'lodash'
import { PipelineStage } from 'mongoose'
import { GET_USER_LOOKUPS } from './user.pipeline'
import { ETransactionDriverStatus } from '@enums/transactions'
import { endOfMonth, startOfMonth } from 'date-fns'
import { escapeRegex } from '@utils/string.utils'

const LOOKUP_DRIVERs: PipelineStage[] = [
  {
    $group: {
      _id: '$ownerId',
      pendingAmount: {
        $sum: {
          $cond: [
            {
              $eq: ['$status', 'PENDING'],
            },
            '$amount',
            0,
          ],
        },
      },
    },
  },
  {
    $lookup: {
      from: 'transactions',
      let: { ownerId: '$_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$ownerId', '$$ownerId'] }, { $eq: ['$refType', 'EARNING'] }] } } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
      ],
      as: 'lastestPaidTransaction',
    },
  },
  {
    $addFields: {
      lastestPaid: { $arrayElemAt: ['$lastestPaidTransaction.createdAt', 0] },
    },
  },
  {
    $addFields: {
      ownerIdAsObjectId: {
        $toObjectId: '$_id',
      },
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'ownerIdAsObjectId',
      foreignField: '_id',
      as: 'driver',
      pipeline: [
        {
          $lookup: {
            from: 'driverdetails',
            localField: 'driverDetail',
            foreignField: '_id',
            as: 'driverDetail',
          },
        },
        {
          $unwind: {
            path: '$driverDetail',
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
    },
  },
  {
    $unwind: {
      path: '$driver',
      preserveNullAndEmptyArrays: true,
    },
  },
  // {
  //   $project: {
  //     _id: 0,
  //     driver: 1,
  //     pendingAmount: 1,
  //     driverType: '$driver.userType',
  //     status: 1,
  //   },
  // },
]

export const TRANSACTION_DRIVER_LIST = (queries: GetDriverTransactionArgs, sort = {}) => {
  const { driverName, driverType, isPending } = queries

  //   const startOfCreated = dateRangeStart ? new Date(new Date(dateRangeStart).setHours(0, 0, 0, 0)) : null
  //   const endOfCreated = dateRangeEnd ? new Date(new Date(dateRangeEnd).setHours(23, 59, 59, 999)) : null

  const prematch: PipelineStage = {
    $match: {
      refType: ERefType.SHIPMENT,
      ownerType: ETransactionOwner.DRIVER,
      transactionType: ETransactionType.INCOME,
    },
  }

  const orderConditions: PipelineStage = {
    $addFields: {
      statusWeight: {
        $switch: {
          branches: [
            {
              case: {
                $gt: ['$pendingAmount', 0],
              },
              then: 0,
            },
          ],
          default: 1,
        },
      },
    },
  }

  const drivers = driverName
    ? [
        {
          $match: {
            $or: [
              { 'driver.driverDetail.firstname': { $regex: driverName, $options: 'i' } },
              { 'driver.driverDetail.lastname': { $regex: driverName, $options: 'i' } },
              { 'driver.driverDetail.businessName': { $regex: driverName, $options: 'i' } },
            ],
          },
        },
      ]
    : []

  const driverTypes = driverType ? [{ $match: { 'driver.userType': driverType } }] : []

  const pendiingStatusMatchs: PipelineStage[] =
    typeof isPending === 'boolean' ? [{ $match: { statusWeight: isPending ? 0 : 1 } }] : []

  const postmatch: PipelineStage[] = [...drivers, ...driverTypes, ...pendiingStatusMatchs]

  const sorts: PipelineStage = { $sort: { statusWeight: 1, pendingAmount: -1, ...sort } }

  const project: PipelineStage = {
    $project: { _id: 0, driver: 1, driverType: '$driver.userType', pendingAmount: 1, lastestPaid: 1 },
  }

  return [prematch, ...LOOKUP_DRIVERs, orderConditions, ...postmatch, sorts, project]
}

export const DRIVER_TRANSACTIONS = (driverId: string, queries: GetTransactionsArgs, sort = {}) => {
  const { endDate, startDate, shipmentTracking, transactionStatus, transactionType, refType } = queries

  const startOfCreated = startDate ? new Date(new Date(startDate).setHours(0, 0, 0, 0)) : null
  const endOfCreated = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null

  const ref = refType || ERefType.SHIPMENT
  const prematch: PipelineStage = {
    $match: {
      ownerId: driverId,
      refType: ref,
      ownerType: ETransactionOwner.DRIVER,
      ...(transactionStatus ? { status: transactionStatus } : {}),
      ...(transactionType ? { transactionType } : {}),
      ...(startOfCreated || endOfCreated
        ? {
            createdAt: {
              ...(startOfCreated ? { $gte: startOfCreated } : {}),
              ...(endOfCreated ? { $lte: endOfCreated } : {}),
            },
          }
        : {}),
    },
  }

  const lookupRefTypes: PipelineStage[] =
    ref === ERefType.SHIPMENT
      ? [
          {
            $addFields: {
              refIdAsObjectId: {
                $toObjectId: '$refId',
              },
            },
          },
          {
            $lookup: {
              from: 'shipments',
              localField: 'refIdAsObjectId',
              foreignField: '_id',
              as: 'shipment',
            },
          },
          {
            $unwind: {
              path: '$shipment',
              preserveNullAndEmptyArrays: true,
            },
          },
        ]
      : ref === ERefType.EARNING
      ? [
          {
            $addFields: {
              refIdAsObjectId: {
                $toObjectId: '$refId',
              },
            },
          },
          {
            $lookup: {
              from: 'driverpayments',
              localField: 'refIdAsObjectId',
              foreignField: '_id',
              as: 'driverPayment',
              pipeline: [
                {
                  $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy',
                    pipeline: [
                      {
                        $lookup: {
                          from: 'admins',
                          localField: 'adminDetail',
                          foreignField: '_id',
                          as: 'adminDetail',
                        },
                      },
                      {
                        $unwind: {
                          path: '$adminDetail',
                          preserveNullAndEmptyArrays: true,
                        },
                      },
                    ],
                  },
                },
                {
                  $unwind: {
                    path: '$createdBy',
                    preserveNullAndEmptyArrays: true,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: '$driverPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
        ]
      : []

  const shipment = shipmentTracking
    ? ref === ERefType.SHIPMENT
      ? [{ $match: { 'shipment.trackingNumber': { $regex: shipmentTracking, $options: 'i' } } }]
      : []
    : []

  const postmatch: PipelineStage[] = [...shipment]

  const sorts: PipelineStage[] = !isEmpty(sort) ? [{ $sort: { ...sort } }] : []

  const project: PipelineStage = {
    $project: {
      _id: 1,
      shipment: 1,
      driverPayment: 1,
      amount: 1,
      transactionType: 1,
      description: 1,
      status: 1,
      lastestPaid: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  }

  return [prematch, ...lookupRefTypes, ...postmatch, ...sorts, project]
}

export const GET_DRIVER_TRANSACTION_SUMMARY = (filters: GetDriverTransactionInput, sort = {}) => {
  const filterMatchStage: any = {}

  // --- สร้างเงื่อนไขการกรอง (Filter) ---
  if (filters?.driverName) {
    const safeDriverName = escapeRegex(filters.driverName)
    filterMatchStage.driverName = { $regex: safeDriverName, $options: 'i' }
  }
  if (!isEmpty(filters?.driverTypes)) {
    filterMatchStage.driverType = { $in: filters.driverTypes }
  }
  if (!isEmpty(filters?.statuses) && !includes(filters.statuses, ETransactionDriverStatus.ALL)) {
    filterMatchStage.finalStatus = { $in: filters.statuses }
  }

  // --- สร้างเงื่อนไขการเรียง (Sort) ---
  const sortStage: any = sort
  // เพิ่มการเรียงลำดับรอง เพื่อให้ผลลัพธ์คงที่
  // sortStage['driverName'] = 1

  // หาวันที่เริ่มต้นและสิ้นสุดของเดือนปัจจุบัน
  const startOfCurrentMonth = startOfMonth(new Date())
  const endOfCurrentMonth = endOfMonth(new Date())

  const pipeline: any[] = [
    // 1. กรองเอาเฉพาะรายการ "รายรับ" ของ "คนขับ"
    {
      $match: {
        ownerType: ETransactionOwner.DRIVER,
        transactionType: ETransactionType.INCOME,
        ownerId: { $exists: true, $ne: null }, // เพิ่มเงื่อนไขป้องกันค่า null
      },
    },
    // ✨ --- ขั้นตอนที่เพิ่มเข้ามา: แปลง ownerId (string) เป็น ObjectId --- ✨
    {
      $addFields: {
        ownerObjectId: { $toObjectId: '$ownerId' },
      },
    },
    // 2. Join กับ User collection เพื่อเอาข้อมูลคนขับ
    {
      $lookup: {
        from: 'users',
        localField: 'ownerObjectId', // ✅ ใช้ field ที่แปลงแล้ว
        foreignField: '_id',
        as: 'driverInfo',
        pipeline: GET_USER_LOOKUPS(true),
      },
    },
    {
      $unwind: {
        // ใช้วิธีนี้เพื่อป้องกัน error หาก lookup ไม่เจอข้อมูล
        path: '$driverInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$ownerId',
        title: {
          $first: {
            $cond: {
              if: { $eq: ['$driverInfo.driverDetail.title', 'อื่นๆ'] },
              then: '$driverInfo.driverDetail.otherTitle',
              else: '$driverInfo.driverDetail.title',
            },
          },
        },
        driverName: {
          $first: {
            $cond: {
              if: { $eq: ['$driverInfo.userType', 'BUSINESS'] },
              then: '$driverInfo.driverDetail.businessName',
              else: {
                $concat: [
                  { $ifNull: ['$driverInfo.driverDetail.firstname', ''] },
                  ' ',
                  { $ifNull: ['$driverInfo.driverDetail.lastname', ''] },
                ],
              },
            },
          },
        },
        driverNumber: { $first: '$driverInfo.userNumber' },
        profileImage: { $first: '$driverInfo.profileImage.filename' },
        driverType: { $first: '$driverInfo.userType' },

        netTotalAmount: {
          $sum: {
            $cond: {
              if: { $eq: ['$transactionType', ETransactionType.INCOME] },
              then: '$amount',
              else: { $multiply: ['$amount', -1] }, // Subtract amount for OUTCOME
            },
          },
        },

        hasPaymentThisMonth: {
          $max: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', ETransactionStatus.COMPLETE] },
                  { $gte: ['$createdAt', startOfCurrentMonth] },
                  { $lte: ['$createdAt', endOfCurrentMonth] },
                ],
              },
              1, // ถ้าเงื่อนไขเป็นจริง ให้ค่าเป็น 1
              0, // ถ้าไม่เป็นจริง ให้ค่าเป็น 0
            ],
          },
        },

        lastPaymentDate: {
          $max: {
            $cond: [{ $eq: ['$status', ETransactionStatus.COMPLETE] }, '$createdAt', null],
          },
        },
        statuses: { $addToSet: '$status' },
      },
    },
    // ✅ สร้าง field 'finalStatus' (สถานะสรุป) ตามนิยามใหม่
    {
      $addFields: {
        finalStatus: {
          $switch: {
            branches: [
              // ลำดับความสำคัญสูงสุด: ยกเลิกการชำระ
              { case: { $in: [ETransactionStatus.CANCELED, '$statuses'] }, then: ETransactionDriverStatus.CANCELLED },
              // ค้างชำระ
              {
                case: { $in: [ETransactionStatus.OUTSTANDING, '$statuses'] },
                then: ETransactionDriverStatus.OUTSTANDING,
              },
              // อยู่ในรอบชำระ
              { case: { $in: [ETransactionStatus.PENDING, '$statuses'] }, then: ETransactionDriverStatus.PENDING },
              // ชำระแล้ว (มีการชำระในเดือนนี้)
              { case: { $eq: ['$hasPaymentThisMonth', 1] }, then: ETransactionDriverStatus.COMPLETE },
              // ไม่มียอดค้างชำระ (ยอดรวมเป็น 0 และไม่มีสถานะอื่นค้างอยู่)
              { case: { $eq: ['$netTotalAmount', 0] }, then: ETransactionDriverStatus.NON_OUTSTANDING },
            ],
            // หากไม่เข้าเงื่อนไขไหนเลย ให้ถือเป็นสถานะ PENDING (อาจมีรายการเข้ามาใหม่)
            default: ETransactionDriverStatus.PENDING,
          },
        },
      },
    },
    {
      $addFields: {
        statusSortOrder: {
          $switch: {
            branches: [
              // เรียงตามลำดับความสำคัญในการจัดการ
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.PENDING] }, then: 1 },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.OUTSTANDING] }, then: 2 },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.CANCELLED] }, then: 3 },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.COMPLETE] }, then: 4 },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.NON_OUTSTANDING] }, then: 5 },
            ],
            default: 99,
          },
        },
      },
    },
    {
      $addFields: {
        statusName: {
          $switch: {
            branches: [
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.NON_OUTSTANDING] }, then: 'ไม่มียอดค้างชำระ' },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.PENDING] }, then: 'อยู่ในรอบชำระ' },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.COMPLETE] }, then: 'ชำระแล้ว' },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.OUTSTANDING] }, then: 'ค้างชำระ' },
              { case: { $eq: ['$finalStatus', ETransactionDriverStatus.CANCELLED] }, then: 'ยกเลิกการชำระ' },
            ],
            default: 'ไม่ระบุสถานะ',
          },
        },
      },
    },
    // ✅ --- เพิ่ม Sort Stage ที่นี่ ---
    ...(isEmpty(filterMatchStage) ? [] : [{ $match: filterMatchStage }]),
    ...(isEmpty(sortStage) ? [{ $sort: { statusSortOrder: 1 } }] : [{ $sort: sortStage }]),
    // 6. Project fields สุดท้าย
    {
      $project: {
        _id: 0,
        driverId: '$_id',
        title: 1,
        driverName: { $trim: { input: '$driverName' } }, // Trim whitespace
        driverNumber: 1,
        driverType: 1,
        profileImage: 1,
        status: '$finalStatus',
        statusName: 1,
        netTotalAmount: 1,
        lastPaymentDate: 1,
      },
    },
  ]
  return pipeline
}
