import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { GetShipmentArgs } from '@inputs/shipment.input'
import { isEmpty } from 'lodash'
import { PipelineStage, Types } from 'mongoose'

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
    paymentNumber,
    paymentStatus,
    customerName,
    driverName,
    driverAgentName,
    customerId,
    driverId,
  }: GetShipmentArgs,
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
    ...(user_role === 'customer' && user_id ? { customer: user_id } : {}),
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

  const payments =
    paymentMethod || paymentNumber || paymentStatus
      ? [
          {
            $match: {
              ...(paymentMethod ? { 'payment.paymentMethod': paymentMethod } : {}),
              ...(paymentNumber ? { 'payment.paymentNumber': { $regex: paymentNumber, $options: 'i' } } : {}),
              ...(paymentStatus ? { 'payment.status': paymentStatus } : {}),
            },
          },
        ]
      : []

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
              { 'driver.individualDriver.firstname': { $regex: driverName, $options: 'i' } },
              { 'driver.individualDriver.lastname': { $regex: driverName, $options: 'i' } },
            ],
          },
        },
      ]
    : []

  const sorts: PipelineStage[] = [{ $sort: { statusWeight: 1, ...sort } }]

  return [
    {
      $match: {
        ...matchConditions,
        ...(!isEmpty(orQuery) ? { $or: orQuery } : {}),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'customer',
        foreignField: '_id',
        as: 'customer',
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
        path: '$customer',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'driver',
        foreignField: '_id',
        as: 'driver',
        pipeline: [
          {
            // TODO: Recheck for business
            $lookup: {
              from: 'individualdrivers',
              localField: 'individualDriver',
              foreignField: '_id',
              as: 'individualDriver',
            },
          },
          {
            $unwind: {
              path: '$individualDriver',
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
    {
      $lookup: {
        from: 'users',
        localField: 'requestedDriver',
        foreignField: '_id',
        as: 'requestedDriver',
        pipeline: [
          {
            // TODO: Recheck for business
            $lookup: {
              from: 'individualdrivers',
              localField: 'individualDriver',
              foreignField: '_id',
              as: 'individualDriver',
            },
          },
          {
            $unwind: {
              path: '$individualDriver',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$requestedDriver',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'files',
        localField: 'additionalImages',
        foreignField: '_id',
        as: 'additionalImages',
      },
    },
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
                              },
                            },
                          ],
                        },
                      },
                      {
                        $unwind: {
                          path: '$descriptions',
                          preserveNullAndEmptyArrays: true,
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
        localField: 'directionId',
        foreignField: '_id',
        as: 'directionId',
      },
    },
    {
      $unwind: {
        path: '$directionId',
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
        from: 'payments',
        localField: 'payment',
        foreignField: '_id',
        as: 'payment',
      },
    },
    {
      $unwind: {
        path: '$payment',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
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
    },
    ...payments,
    ...customers,
    ...drivers,
    ...sorts,
  ]
}
