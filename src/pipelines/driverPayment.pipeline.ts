import { GetDriverPaymentArgs } from '@inputs/driver-payment.input'
import { PipelineStage, Types } from 'mongoose'
import { isEmpty } from 'lodash'
import { userPipelineStage } from './user.pipeline'

export const DRIVER_PAYMENTS = (queries: GetDriverPaymentArgs, sort = {}) => {
  const { endDate, startDate, shipmentTracking, driverId, driverName, driverNumber } = queries

  const startOfCreated = startDate ? new Date(new Date(startDate).setHours(0, 0, 0, 0)) : null
  const endOfCreated = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null

  const prematch: PipelineStage = {
    $match: {
      ...(driverId ? { driver: new Types.ObjectId(driverId) } : {}),
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

  const lookupRefTypes: PipelineStage[] = [
    ...userPipelineStage('driver'),
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
        from: 'transactions',
        localField: 'transactions',
        foreignField: '_id',
        as: 'transactions',
      },
    },
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
    {
      $lookup: {
        from: 'files',
        localField: 'imageEvidence',
        foreignField: '_id',
        as: 'imageEvidence',
      },
    },
    {
      $unwind: {
        path: '$imageEvidence',
        preserveNullAndEmptyArrays: true,
      },
    },
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
  ]

  const shipment: PipelineStage[] = shipmentTracking
    ? [{ $match: { 'shipment.trackingNumber': { $regex: shipmentTracking, $options: 'i' } } }]
    : []

  const driverNames: PipelineStage[] = driverName
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

  const driverNumbers: PipelineStage[] = driverNumber ? [{ $match: { 'driver.userNumber': driverNumber } }] : []

  const postmatch: PipelineStage[] = [...shipment, ...driverNames, ...driverNumbers]

  const sorts: PipelineStage[] = !isEmpty(sort) ? [{ $sort: { ...sort } }] : []

  return [prematch, ...lookupRefTypes, ...postmatch, ...sorts]
}
