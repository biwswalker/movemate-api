import { EUserCriterialType, EUserRole, EUserStatus, EUserValidationStatus } from '@enums/users'
import { GetUserPendingArgs } from '@inputs/user.input'
import { PipelineStage } from 'mongoose'

export const GET_PENDING_USERS = (
  {
    userId,
    userNumber,
    userRole,
    userType,
    username,
    status,
    requestStart,
    requestEnd,
    email,
    name,
    phoneNumber,
    taxId,
  }: Partial<GetUserPendingArgs>,
  sort = {},
): PipelineStage[] => {
  const detailMatch =
    userRole === EUserRole.CUSTOMER && userType === EUserCriterialType.INDIVIDUAL
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
      : userRole === EUserRole.CUSTOMER && userType === EUserCriterialType.BUSINESS
      ? {
          ...(email ? { 'businessDetail.businessEmail': { $regex: email, $options: 'i' } } : {}),
          ...(name ? { 'businessDetail.businessName': { $regex: name, $options: 'i' } } : {}),
          ...(phoneNumber ? { 'businessDetail.contactNumber': { $regex: phoneNumber, $options: 'i' } } : {}),
          ...(taxId ? { 'businessDetail.taxNumber': { $regex: taxId, $options: 'i' } } : {}),
        }
      : userRole === EUserRole.DRIVER
      ? {
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
        }
      : {}

  const prematch: PipelineStage = {
    $match: {
      ...(userId ? { userId } : {}),
      $or: [
        {
          ...(userType && userType !== EUserCriterialType.ALL ? { userType: userType } : {}),
          ...(status ? { status: status } : {}),
          ...(userNumber ? { userNumber: { $regex: userNumber, $options: 'i' } } : {}),
          ...(username ? { username: { $regex: username, $options: 'i' } } : {}),
        },
      ],
    },
  }

  const postmatch: PipelineStage[] = detailMatch ? [{ $match: detailMatch }] : []

  return [
    ...(prematch.$match ? [prematch] : []),
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
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
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
        ],
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'approvalBy',
        foreignField: '_id',
        as: 'approvalBy',
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
        path: '$approvalBy',
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
