import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { GetShipmentInput } from '@inputs/shipment.input'
import { PipelineStage, Types } from 'mongoose'
import { isEmpty } from 'lodash'
import { EUserRole } from '@enums/users'
import { fileLookup, filePipelineStage } from './file.pipline'
import { userPipelineStage } from './user.pipeline'

const LOOKUPs: PipelineStage[] = [
  ...userPipelineStage('customer'),
  ...userPipelineStage('driver'),
  ...userPipelineStage('agentDriver'),
  ...userPipelineStage('requestedDriver'),
  fileLookup('additionalImages'),
  {
    $lookup: {
      from: 'vehicletypes',
      localField: 'vehicleId',
      foreignField: '_id',
      as: 'vehicleId',
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
    $unwind: {
      path: '$vehicleId',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'shipmentadditionalserviceprices',
      localField: 'additionalServices',
      foreignField: '_id',
      as: 'additionalServices',
      pipeline: [
        {
          $lookup: {
            from: 'additionalservicecostpricings',
            localField: 'reference',
            foreignField: '_id',
            as: 'reference',
            pipeline: [
              {
                $lookup: {
                  from: 'additionalservices',
                  localField: 'additionalService',
                  foreignField: '_id',
                  as: 'additionalService',
                  pipeline: [
                    {
                      $lookup: {
                        from: 'additionalservicedescriptions',
                        localField: 'descriptions',
                        foreignField: '_id',
                        as: 'descriptions',
                        pipeline: [
                          {
                            $lookup: {
                              from: 'vehicletypes',
                              localField: 'vehicleTypes',
                              foreignField: '_id',
                              as: 'vehicleTypes',
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
                        ],
                      },
                    },
                  ],
                },
              },
              {
                $unwind: {
                  path: '$additionalService',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$reference',
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
    },
  },
  {
    $lookup: {
      from: 'shipmentdistancepricings',
      localField: 'distances',
      foreignField: '_id',
      as: 'distances',
    },
  },
  {
    $lookup: {
      from: 'privileges',
      localField: 'discountId',
      foreignField: '_id',
      as: 'discountId',
    },
  },
  {
    $unwind: {
      path: '$discountId',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'directionsresults',
      localField: 'route',
      foreignField: '_id',
      as: 'route',
    },
  },
  {
    $unwind: {
      path: '$route',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'stepdefinitions',
      localField: 'steps',
      foreignField: '_id',
      as: 'steps',
      pipeline: [
        {
          $lookup: {
            from: 'files',
            localField: 'images',
            foreignField: '_id',
            as: 'images',
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
      pipeline: [
        ...userPipelineStage('updatedBy')
      ]
    },
  },
]

export const SHIPMENT_LIST = (
  {
    dateRangeStart,
    dateRangeEnd,
    trackingNumber,
    vehicleTypeId,
    status,
    startWorkingDate,
    endWorkingDate,
    paymentMethod,
    // paymentNumber,
    // paymentStatus,
    customerName,
    driverName,
    driverAgentName,
    customerId,
    driverId,
  }: GetShipmentInput,
  user_role: string | undefined,
  user_id: string | undefined,
  sort = {},
) => {
  const statusFilterOr =
    status === EShipmentStatusCriteria.ALL
      ? [
          EShipmentStatus.IDLE,
          EShipmentStatus.PROGRESSING,
          EShipmentStatus.DELIVERED,
          EShipmentStatus.CANCELLED,
          EShipmentStatus.REFUND,
        ]
      : status === EShipmentStatusCriteria.PAYMENT_VERIFY || status === EShipmentStatusCriteria.WAITING_DRIVER
      ? [EShipmentStatus.IDLE]
      : [status]

  const startOfCreated = dateRangeStart ? new Date(new Date(dateRangeStart).setHours(0, 0, 0, 0)) : null
  const endOfCreated = dateRangeEnd ? new Date(new Date(dateRangeEnd).setHours(23, 59, 59, 999)) : null
  const startOfWorking = startWorkingDate ? new Date(new Date(startWorkingDate).setHours(0, 0, 0, 0)) : null
  const endOfWorking = endWorkingDate ? new Date(new Date(endWorkingDate).setHours(23, 59, 59, 999)) : null
  const matchConditions = {
    ...(vehicleTypeId ? { vehicleId: new Types.ObjectId(vehicleTypeId) } : {}),
    ...(startOfCreated || endOfCreated
      ? {
          createdAt: {
            ...(startOfCreated ? { $gte: startOfCreated } : {}),
            ...(endOfCreated ? { $lte: endOfCreated } : {}),
          },
        }
      : {}),
    ...(startOfWorking && endOfWorking
      ? {
          bookingDateTime: {
            ...(startOfWorking ? { $gte: startOfWorking } : {}),
            ...(endOfWorking ? { $lte: endOfWorking } : {}),
          },
        }
      : {}),
    ...(user_role === EUserRole.CUSTOMER && user_id ? { customer: user_id } : {}),
    ...(customerId ? { customer: new Types.ObjectId(customerId) } : {}),
    ...(driverId ? { driver: new Types.ObjectId(driverId) } : {}),
    ...(status === EShipmentStatusCriteria.PAYMENT_VERIFY
      ? { adminAcceptanceStatus: EAdminAcceptanceStatus.PENDING }
      : {}),
    ...(status === EShipmentStatusCriteria.WAITING_DRIVER
      ? { driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING }
      : {}),
  }

  const orQuery = [
    ...(trackingNumber
      ? [
          {
            trackingNumber: { $regex: trackingNumber, $options: 'i' },
            $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [],
          },
          {
            refId: { $regex: trackingNumber, $options: 'i' },
            $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [],
          },
        ]
      : !isEmpty(statusFilterOr)
      ? [{ status: { $in: statusFilterOr } }]
      : []),
  ]

  // TODO: Refactor this
  const payments = paymentMethod ? [{ $match: { paymentMethod } }] : []
  // const payments =
  //   paymentMethod || paymentNumber || paymentStatus
  //     ? [
  //         {
  //           $match: {
  //             ...(paymentMethod ? { 'paymentMethod': paymentMethod } : {}),
  //             ...(paymentNumber ? { 'payments.paymentNumber': { $regex: paymentNumber, $options: 'i' } } : {}),
  //             ...(paymentStatus ? { 'payments.status': paymentStatus } : {}),
  //           },
  //         },
  //       ]
  //     : []

  const customers = customerName
    ? [
        {
          $match: {
            $or: [
              { 'customer.individualDetail.firstname': { $regex: customerName, $options: 'i' } },
              { 'customer.individualDetail.lastname': { $regex: customerName, $options: 'i' } },
              { 'customer.businessDetail.businessName': { $regex: customerName, $options: 'i' } },
            ],
          },
        },
      ]
    : []

  const drivers = driverName
    ? [
        {
          $match: {
            $or: [
              { 'driver.driverDetail.firstname': { $regex: driverName, $options: 'i' } },
              { 'driver.driverDetail.lastname': { $regex: driverName, $options: 'i' } },
            ],
          },
        },
      ]
    : []

  const agentDrivers = driverAgentName
    ? [
        {
          $match: {
            'agentDriver.driverDetail.businessName': { $regex: driverAgentName, $options: 'i' },
          },
        },
      ]
    : []

  const sorts: PipelineStage[] = [{ $sort: { statusWeight: 1, ...sort } }]

  const orderConditions: PipelineStage = {
    $addFields: {
      statusWeight: {
        $switch: {
          branches: [
            {
              case: {
                $eq: ['$status', EShipmentStatus.IDLE],
              },
              then: 0,
            },
            {
              case: {
                $eq: ['$status', EShipmentStatus.REFUND],
              },
              then: 1,
            },
            {
              case: {
                $eq: ['$status', EShipmentStatus.PROGRESSING],
              },
              then: 2,
            },
            {
              case: {
                $eq: ['$status', EShipmentStatus.DELIVERED],
              },
              then: 3,
            },
          ],
          default: 4,
        },
      },
    },
  }

  return [
    {
      $match: {
        ...matchConditions,
        ...(!isEmpty(orQuery) ? { $or: orQuery } : {}),
      },
    },
    ...LOOKUPs,
    orderConditions,
    ...payments,
    ...customers,
    ...drivers,
    ...agentDrivers,
    ...sorts,
  ]
}
