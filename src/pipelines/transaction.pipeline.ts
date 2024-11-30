import { GetDriverTransactionArgs, GetTransactionsArgs } from '@inputs/transactions.input'
import { ERefType, ETransactionOwner, ETransactionType } from '@models/transaction.model'
import { isEmpty } from 'lodash'
import { PipelineStage } from 'mongoose'

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
