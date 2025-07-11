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
import { userPipelineStage } from './user.pipeline'

const GET_SHIPMENT_LIST_LOOKUPs: PipelineStage[] = [
  ...userPipelineStage('customer', true),
  ...userPipelineStage('driver', true),
  ...userPipelineStage('agentDriver', true),
  // ...userPipelineStage('requestedDriver'),
  {
    $lookup: {
      from: 'vehicletypes',
      localField: 'vehicleId',
      foreignField: '_id',
      as: 'vehicle',
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
      path: '$vehicle',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'billings',
      let: { shipment_id: '$_id' },
      pipeline: [{ $match: { $expr: { $in: ['$$shipment_id', '$shipments'] } } }],
      as: 'billing',
    },
  },
  {
    $unwind: {
      path: '$billing',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'stepdefinitions',
      let: { currentStepSeq: '$currentStepSeq', steps: '$steps' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [{ $in: ['$_id', '$$steps'] }, { $eq: ['$seq', '$$currentStepSeq'] }],
            },
          },
        },
      ],
      as: 'step',
    },
  },
  {
    $unwind: {
      path: '$step',
      preserveNullAndEmptyArrays: true,
    },
  },
]

export const GET_SHIPMENT_LIST = (
  {
    dateRangeStart,
    dateRangeEnd,
    trackingNumber,
    vehicleTypeId,
    status,
    startWorkingDate,
    endWorkingDate,
    paymentMethod,
    billingStatus,
    customerName,
    driverName,
    driverAgentName,
    customerId,
    driverId,
    sortOrder,
  }: GetShipmentInput,
  user_role: string | undefined,
  user_id: string | undefined,
  sort = {},
  skip: number | undefined = undefined,
  limit: number | undefined = undefined,
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
    ...(user_role === EUserRole.CUSTOMER && user_id ? { customer: new Types.ObjectId(user_id) } : {}),
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

  const initialMatch = {
    $match: {
      ...matchConditions,
      ...(!isEmpty(orQuery) ? { $or: orQuery } : {}),
    },
  }

  const payments = paymentMethod ? [{ $match: { paymentMethod } }] : []

  const billingStatuss = billingStatus ? [{ $match: { 'billing.status': billingStatus } }] : []

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

  // 2. All Lookups and subsequent filters
  const secondaryMatchConditions = [...payments, ...billingStatuss, ...customers, ...drivers, ...agentDrivers]

  const lookups = GET_SHIPMENT_LIST_LOOKUPs

  const addSortField: PipelineStage = {
    $addFields: {
      statusWeight: {
        $switch: {
          branches: sortOrder
            ? sortOrder.map((status, index) => ({ case: { $eq: ['$status', status] }, then: index }))
            : [
                {
                  case: { $eq: ['$status', EShipmentStatus.IDLE] },
                  then: 0,
                },
                {
                  case: { $eq: ['$status', EShipmentStatus.REFUND] },
                  then: 1,
                },
                {
                  case: { $eq: ['$status', EShipmentStatus.PROGRESSING] },
                  then: 2,
                },
                {
                  case: { $eq: ['$status', EShipmentStatus.DELIVERED] },
                  then: 3,
                },
              ],
          default: 99,
        },
      },
      billingStatus: '$billing.status',
      billingState: '$billing.state',
      vehicleName: '$vehicle.name',
      vehicleImage: '$vehicle.image.filename',
      customerTitle: {
        $switch: {
          branches: [
            {
              case: { $eq: ['$customer.userType', 'INDIVIDUAL'] },
              then: {
                $cond: {
                  if: { $eq: ['$customer.individualDetail.title', 'อื่นๆ'] },
                  then: '$customer.individualDetail.otherTitle',
                  else: '$customer.individualDetail.title',
                },
              },
            },
            {
              case: { $eq: ['$customer.userType', 'BUSINESS'] },
              then: '$customer.businessDetail.businessTitle',
            },
          ],
          default: '',
        },
      },
      customerName: {
        $cond: {
          if: { $eq: ['$customer.userType', 'BUSINESS'] },
          then: '$customer.businessDetail.businessName',
          else: { $concat: ['$customer.individualDetail.firstname', ' ', '$customer.individualDetail.lastname'] },
        },
      },
      driverTitle: {
        $cond: {
          if: { $eq: ['$driver.driverDetail.title', 'อื่นๆ'] },
          then: '$driver.driverDetail.otherTitle',
          else: '$driver.driverDetail.title',
        },
      },
      driverName: { $concat: ['$driver.driverDetail.firstname', ' ', '$driver.driverDetail.lastname'] },
      driverProfileImage: '$driver.profileImage.filename',
      driverNumber: '$driver.userNumber',
      agentDriverTitle: {
        $cond: {
          if: { $eq: ['$agentDriver.driverDetail.title', 'อื่นๆ'] },
          then: '$agentDriver.driverDetail.otherTitle',
          else: '$agentDriver.driverDetail.title',
        },
      },
      agentDriverName: '$agentDriver.driverDetail.businessName',
    },
  }

  const sortStage: PipelineStage = { $sort: isEmpty(sort) ? { statusWeight: 1, bookingDateTime: -1 } : sort }
  const paginationStages: PipelineStage[] = [
    ...(skip !== undefined ? [{ $skip: skip }] : []),
    ...(limit !== undefined ? [{ $limit: limit }] : []),
  ]
  const projectStages: PipelineStage = {
    $project: {
      _id: 1,
      refId: 1,
      bookingDateTime: 1,
      trackingNumber: 1,
      status: 1,
      adminAcceptanceStatus: 1,
      driverAcceptanceStatus: 1,
      paymentMethod: 1,
      destinations: 1,
      createdAt: 1,
      // Custom Field
      billingStatus: 1,
      billingState: 1,
      vehicleName: 1,
      vehicleImage: 1,
      customerTitle: 1,
      customerName: 1,
      driverTitle: 1,
      driverName: 1,
      agentDriverTitle: 1,
      agentDriverName: 1,
      step: 1,
      driverProfileImage: 1,
      driverNumber: 1,
      cancellationFee: 1,
    },
  }

  return [
    initialMatch,
    ...lookups,
    ...secondaryMatchConditions,
    addSortField,
    sortStage,
    ...paginationStages,
    projectStages,
  ]
}
