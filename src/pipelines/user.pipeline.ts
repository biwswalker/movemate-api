import { EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { GetUserArgs } from '@inputs/user.input'
import { format } from 'date-fns'
import { toNumber } from 'lodash'
import { PipelineStage, Types } from 'mongoose'

export const GET_USERS = ({
  email,
  name,
  phoneNumber,
  taxId,
  userNumber,
  username,
  lineId,
  serviceVehicleType,
  parentId,
  ...query
}: Partial<GetUserArgs>): PipelineStage[] => {
  const detailMatch =
    query.userRole === EUserRole.CUSTOMER && query.userType === EUserType.INDIVIDUAL
      ? {
          ...(email ? { 'individualDetail.email': { $regex: email, $options: 'i' } } : {}),
          ...(name
            ? {
                $or: [
                  { 'individualDetail.firstname': { $regex: name, $options: 'i' } },
                  { 'individualDetail.lastname': { $regex: name, $options: 'i' } },
                ],
              }
            : {}),
          ...(phoneNumber ? { 'individualDetail.phoneNumber': { $regex: phoneNumber, $options: 'i' } } : {}),
          ...(taxId ? { 'individualDetail.taxId': { $regex: taxId, $options: 'i' } } : {}),
        }
      : query.userRole === EUserRole.CUSTOMER && query.userType === EUserType.BUSINESS
      ? {
          ...(email ? { 'businessDetail.businessEmail': { $regex: email, $options: 'i' } } : {}),
          ...(name ? { 'businessDetail.businessName': { $regex: name, $options: 'i' } } : {}),
          ...(phoneNumber ? { 'businessDetail.contactNumber': { $regex: phoneNumber, $options: 'i' } } : {}),
          ...(taxId ? { 'businessDetail.taxNumber': { $regex: taxId, $options: 'i' } } : {}),
        }
      : query.userRole === EUserRole.DRIVER
      ? {
          ...(lineId ? { 'driverDetail.lineId': { $regex: lineId, $options: 'i' } } : {}),
          ...(name
            ? {
                $or: [
                  { 'driverDetail.firstname': { $regex: name, $options: 'i' } },
                  { 'driverDetail.lastname': { $regex: name, $options: 'i' } },
                  { 'driverDetail.businessName': { $regex: name, $options: 'i' } },
                ],
              }
            : {}),
          ...(phoneNumber ? { 'driverDetail.phoneNumber': { $regex: phoneNumber, $options: 'i' } } : {}),
          ...(taxId ? { 'driverDetail.taxNumber': { $regex: taxId, $options: 'i' } } : {}),
          ...(serviceVehicleType
            ? {
                'driverDetail.serviceVehicleTypes': {
                  $in: [new Types.ObjectId(serviceVehicleType)],
                },
              }
            : {}),
        }
      : {}

  const statusFilter =
    query.userRole === EUserRole.CUSTOMER
      ? [
          ...((query.userType === EUserType.BUSINESS && query.status === EUserStatus.PENDING) ||
          (query.userType === EUserType.BUSINESS && query.status === undefined)
            ? [
                {
                  userType: EUserType.INDIVIDUAL,
                  validationStatus: EUserValidationStatus.PENDING,
                  upgradeRequest: { $ne: null },
                },
              ]
            : []),
        ]
      : []

  return [
    {
      $match: {
        $or: [
          {
            ...query,
            ...(userNumber ? { userNumber: { $regex: userNumber, $options: 'i' } } : {}),
            ...(username ? { username: { $regex: username, $options: 'i' } } : {}),
          },
          ...statusFilter,
        ],
        ...(parentId ? { parents: { $in: [parentId] } } : {}),
      },
    },
    {
      $lookup: {
        from: 'businesscustomers',
        localField: 'businessDetail',
        foreignField: '_id',
        as: 'businessDetail',
        pipeline: [
          {
            $lookup: {
              from: 'businesscustomercreditpayments',
              localField: 'creditPayment',
              foreignField: '_id',
              as: 'creditPayment',
            },
          },
          {
            $unwind: {
              path: '$creditPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'businesscustomercashpayments',
              localField: 'cashPayment',
              foreignField: '_id',
              as: 'cashPayment',
            },
          },
          {
            $unwind: {
              path: '$cashPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
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
        from: 'businesscustomers',
        localField: 'upgradeRequest',
        foreignField: '_id',
        as: 'upgradeRequest',
        pipeline: [
          {
            $lookup: {
              from: 'businesscustomercreditpayments',
              localField: 'creditPayment',
              foreignField: '_id',
              as: 'creditPayment',
            },
          },
          {
            $unwind: {
              path: '$creditPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'businesscustomercashpayments',
              localField: 'cashPayment',
              foreignField: '_id',
              as: 'cashPayment',
            },
          },
          {
            $unwind: {
              path: '$cashPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$upgradeRequest',
        preserveNullAndEmptyArrays: true,
      },
    },
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
    {
      $lookup: {
        from: 'driverdetails',
        localField: 'driverDetail',
        foreignField: '_id',
        as: 'driverDetail',
        pipeline: [
          {
            $lookup: {
              from: 'vehicletypes',
              localField: 'serviceVehicleTypes',
              foreignField: '_id',
              as: 'serviceVehicleTypes',
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
    {
      $unwind: {
        path: '$driverDetail',
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
    {
      $addFields: {
        statusWeight: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: ['$status', EUserStatus.PENDING],
                },
                then: 0,
              },
            ],
            default: 1,
          },
        },
      },
    },
    {
      $sort: {
        statusWeight: 1,
      },
    },
    { $match: detailMatch },
  ]
}

export const EXISTING_USERS = (_id: string, email: string, userType: EUserType, userRole: EUserRole) => [
  {
    $match: {
      _id: { $ne: new Types.ObjectId(_id) },
      userRole,
      userType,
    },
  },
  ...(userRole === EUserRole.CUSTOMER
    ? userType === EUserType.INDIVIDUAL
      ? [
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
          { $match: { 'individualDetail.email': email } },
        ]
      : [
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
          { $match: { 'businessDetail.businessEmail': email } },
        ]
    : []),
]

export const GET_CUSTOMER_BY_EMAIL = (email: string) => [
  {
    $lookup: {
      from: 'individualcustomers',
      localField: 'individualDetail',
      foreignField: '_id',
      as: 'individualDetail',
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
    $match: {
      $or: [{ 'individualDetail.email': email }, { 'businessDetail.businessEmail': email }],
    },
  },
  {
    $unwind: {
      path: '$individualDetail',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $unwind: {
      path: '$businessDetail',
      preserveNullAndEmptyArrays: true,
    },
  },
]

export const GET_CUSTOMER_WITH_TODAY_BILLED_DATE = () => {
  const today = new Date()
  const currentMonth = format(today, 'MMM').toLowerCase()
  const currentDay = toNumber(format(today, 'dd'))

  return [
    {
      $lookup: {
        from: 'businesscustomers',
        localField: 'businessDetail',
        foreignField: '_id',
        as: 'businessDetail',
        pipeline: [
          {
            $lookup: {
              from: 'businesscustomercreditpayments',
              localField: 'creditPayment',
              foreignField: '_id',
              as: 'creditPayment',
            },
          },
          {
            $unwind: {
              path: '$creditPayment',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$businessDetail',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        [`businessDetail.creditPayment.billedDate.${currentMonth}`]: currentDay,
      },
    },
  ]
}
