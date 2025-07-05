import {
  EUserCriterialStatus,
  EUserCriterialType,
  EUserRole,
  EUserStatus,
  EUserType,
  EUserValidationStatus,
} from '@enums/users'
import { GetUserArgs } from '@inputs/user.input'
import { format } from 'date-fns'
import { isEmpty, toNumber } from 'lodash'
import { PipelineStage, Types } from 'mongoose'
import { filePipelineStage } from './file.pipline'

export function GET_USER_LOOKUPS(lightweight = false) {
  const businessDetailLookup: PipelineStage.Lookup = {
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
            ...(!lightweight && {
              pipeline: [
                ...filePipelineStage('businessRegistrationCertificateFile'),
                ...filePipelineStage('copyIDAuthorizedSignatoryFile'),
                ...filePipelineStage('certificateValueAddedTaxRegistrationFile'),
              ],
            }),
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
  }

  const businessDetailUnwind: PipelineStage.Unwind = {
    $unwind: {
      path: '$businessDetail',
      preserveNullAndEmptyArrays: true,
    },
  }

  const individualDetailLookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'individualcustomers',
      localField: 'individualDetail',
      foreignField: '_id',
      as: 'individualDetail',
    },
  }

  const individualDetailUnwind: PipelineStage.Unwind = {
    $unwind: {
      path: '$individualDetail',
      preserveNullAndEmptyArrays: true,
    },
  }

  const driverDetailLookup: PipelineStage.Lookup = {
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
            ...(!lightweight && {
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
            }),
          },
        },
      ],
    },
  }

  const driverDetailUnwind: PipelineStage.Unwind = {
    $unwind: {
      path: '$driverDetail',
      preserveNullAndEmptyArrays: true,
    },
  }

  const adminDetailLookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'admins',
      localField: 'adminDetail',
      foreignField: '_id',
      as: 'adminDetail',
    },
  }

  const adminDetailUnwind: PipelineStage.Unwind = {
    $unwind: {
      path: '$adminDetail',
      preserveNullAndEmptyArrays: true,
    },
  }

  const upgradeRequestLookup: PipelineStage.Lookup = {
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
  }

  const upgradeRequestUnwind: PipelineStage.Unwind = {
    $unwind: {
      path: '$upgradeRequest',
      preserveNullAndEmptyArrays: true,
    },
  }

  const parentsLookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'users',
      let: {
        parentIds: {
          $map: {
            input: { $ifNull: ['$parents', []] },
            as: 'p',
            in: { $toObjectId: '$$p' },
          },
        },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $in: ['$_id', { $ifNull: ['$$parentIds', []] }],
            },
          },
        },
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
      as: 'parentDetails',
    },
  }

  const parentsProject: PipelineStage.AddFields = {
    $addFields: {
      parents: {
        $map: {
          input: '$parentDetails',
          as: 'parent',
          in: {
            $concat: ['$$parent.driverDetail.title', '$$parent.driverDetail.businessName'],
          },
        },
      },
    },
  }

  return [
    businessDetailLookup,
    businessDetailUnwind,
    individualDetailLookup,
    individualDetailUnwind,
    driverDetailLookup,
    driverDetailUnwind,
    adminDetailLookup,
    adminDetailUnwind,
    upgradeRequestLookup,
    upgradeRequestUnwind,
    ...filePipelineStage('profileImage'),
    parentsLookup,
    parentsProject,
  ]
}

export function userLookup(fieldName: string): PipelineStage.Lookup {
  const lookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'users',
      localField: fieldName,
      foreignField: '_id',
      as: fieldName,
      pipeline: GET_USER_LOOKUPS(),
    },
  }
  return lookup
}

export function userPipelineStage(fieldName: string) {
  const path = `$${fieldName}`

  const lookup = userLookup(fieldName)
  const unwind: PipelineStage.Unwind = {
    $unwind: {
      path,
      preserveNullAndEmptyArrays: true,
    },
  }

  return [lookup, unwind]
}

export const GET_USERS = (
  {
    email,
    name,
    phoneNumber,
    taxId,
    userNumber,
    username,
    lineId,
    serviceVehicleType,
    parentId,
    status,
    userType,
    ...query
  }: Partial<GetUserArgs>,
  sort = {},
): PipelineStage[] => {
  const detailMatch =
    query.userRole === EUserRole.CUSTOMER && userType === EUserCriterialType.INDIVIDUAL
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
      : query.userRole === EUserRole.CUSTOMER && userType === EUserCriterialType.BUSINESS
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
                'driverDetail.serviceVehicleTypes._id': {
                  $in: [new Types.ObjectId(serviceVehicleType)],
                },
              }
            : {}),
        }
      : query.userRole === EUserRole.ADMIN
      ? {
          ...(email ? { 'adminDetail.email': { $regex: email, $options: 'i' } } : {}),
          ...(name
            ? {
                $or: [
                  { 'adminDetail.firstname': { $regex: name, $options: 'i' } },
                  { 'adminDetail.lastname': { $regex: name, $options: 'i' } },
                ],
              }
            : {}),
          ...(phoneNumber ? { 'adminDetail.phoneNumber': { $regex: phoneNumber, $options: 'i' } } : {}),
          ...(taxId ? { 'adminDetail.taxId': { $regex: taxId, $options: 'i' } } : {}),
        }
      : {}

  const statusFilter =
    query.userRole === EUserRole.CUSTOMER
      ? [
          ...((userType === EUserCriterialType.BUSINESS && status === EUserCriterialStatus.PENDING) ||
          (userType === EUserCriterialType.BUSINESS && status === EUserCriterialStatus.ALL)
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

  const _prematchData = {
    ...query,
    ...(userType && userType !== EUserCriterialType.ALL ? { userType: userType } : {}),
    ...(status && status !== EUserCriterialStatus.ALL ? { status: status } : {}),
    ...(userNumber ? { userNumber: { $regex: userNumber, $options: 'i' } } : {}),
    ...(username ? { username: { $regex: username, $options: 'i' } } : {}),
    ...(parentId ? { $or: [{ parents: { $in: [parentId] } }, { requestedParents: { $in: [parentId] } }] } : {}),
  }

  const prematch: PipelineStage = {
    $match: isEmpty(statusFilter) ? _prematchData : { $or: [...statusFilter, _prematchData] },
    // {
    // $or: [
    //   {
    //   },
    //   ...statusFilter,
    //   // ...(parentId ? [{ parents: { $in: [parentId] } }] : []),
    //   // ...(parentId ? [{ requestedParents: { $in: [parentId] } }] : []),
    // ],
    // }
  }

  const postmatch: PipelineStage[] = detailMatch ? [{ $match: detailMatch }] : []

  return [
    ...(prematch.$match ? [prematch] : []),
    ...GET_USER_LOOKUPS(),
    {
      $addFields: {
        statusWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', EUserStatus.PENDING] }, then: 0 },
              { case: { $eq: ['$status', EUserStatus.ACTIVE] }, then: 1 },
              { case: { $eq: ['$status', EUserStatus.INACTIVE] }, then: 2 },
              { case: { $eq: ['$status', EUserStatus.BANNED] }, then: 3 },
              { case: { $eq: ['$status', EUserStatus.DENIED] }, then: 3 },
            ],
            default: 99,
          },
        },
        validationStatusWeight: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: ['$validationStatus', EUserValidationStatus.PENDING],
                },
                then: 0,
              },
            ],
            default: 1,
          },
        },
      },
    },
    { $sort: { validationStatusWeight: 1, statusWeight: 1, ...sort } },
    ...postmatch,
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
          { $match: { $or: [{ 'individualDetail.email': email }, { 'upgradeRequest.businessEmail': email }] } },
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
          { $match: { $or: [{ 'businessDetail.businessEmail': email }, { 'upgradeRequest.businessEmail': email }] } },
        ]
    : []),
]

export const EXISTING_PHONENUMBER = (phonenumber: string, id: string) => [
  ...(id ? [{ $match: { _id: { $ne: new Types.ObjectId(id) } } }] : []),
  ...GET_USER_LOOKUPS(),
  {
    $match: {
      $or: [
        { 'individualDetail.phoneNumber': phonenumber },
        { 'businessDetail.contactNumber': phonenumber },
        { 'upgradeRequest.contactNumber': phonenumber },
      ],
    },
  },
]

export const EXISTING_TAXID = (taxId: string, id: string) => [
  ...(id ? [{ $match: { _id: { $ne: new Types.ObjectId(id) } } }] : []),
  ...GET_USER_LOOKUPS(),
  {
    $match: {
      $or: [
        { 'individualDetail.taxId': taxId },
        { 'businessDetail.taxNumber': taxId },
        { 'upgradeRequest.taxNumber': taxId },
      ],
    },
  },
]

export const EXISTING_BUSINESS_NAME = (businessName: string, id: string) => [
  ...(id ? [{ $match: { _id: { $ne: new Types.ObjectId(id) } } }] : []),
  ...GET_USER_LOOKUPS(),
  {
    $match: { $or: [{ 'businessDetail.businessName': businessName }, { 'upgradeRequest.businessName': businessName }] },
  },
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
        [`businessDetail.creditPayment.billingCycle.${currentMonth}.issueDate`]: currentDay,
      },
    },
  ]
}
