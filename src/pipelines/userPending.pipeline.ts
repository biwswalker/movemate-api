import { EUserCriterialType, EUserRole, EUserStatus, EUserValidationStatus } from '@enums/users'
import { GetUserPendingArgs } from '@inputs/user.input'
import { PipelineStage } from 'mongoose'
import { userPipelineStage } from './user.pipeline'
import { filePipelineStage } from './file.pipline'
import UserModel from '@models/user.model'
import { isEmpty } from 'lodash'

export const GET_PENDING_USERS = async (
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
): Promise<PipelineStage[]> => {
  const incUserIdsRaw = await UserModel.find({ userRole, ...(userType ? { userType } : {}) }).distinct('_id')
  const incUserIds = incUserIdsRaw.map((id) => id?.toString() || '')

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
      ...(userId ? { userId } : { userId: { $in: incUserIds } }),
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

  const postmatch: PipelineStage[] = !isEmpty(detailMatch) ? [{ $match: detailMatch }] : []
  // "businessDetail.creditPayment.financialFirstname"

  const forBusinessCustomer: PipelineStage[] = [
    {
      $lookup: {
        from: 'businesscustomercreditpayments',
        localField: 'businessDetail.creditPayment',
        foreignField: '_id',
        as: 'businessDetail.creditPayment',
        pipeline: [
          ...filePipelineStage('businessRegistrationCertificateFile'),
          ...filePipelineStage('copyIDAuthorizedSignatoryFile'),
          ...filePipelineStage('certificateValueAddedTaxRegistrationFile'),
        ],
      },
    },
    {
      $unwind: {
        path: '$businessDetail.creditPayment',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'businesscustomercashpayments',
        localField: 'businessDetail.cashPayment',
        foreignField: '_id',
        as: 'businessDetail.cashPayment',
      },
    },
    {
      $unwind: {
        path: '$businessDetail.cashPayment',
        preserveNullAndEmptyArrays: true,
      },
    },
  ]

  const forDriver: PipelineStage[] = [
    {
      $lookup: {
        from: 'vehicletypes',
        localField: 'driverDetail.serviceVehicleTypes',
        foreignField: '_id',
        as: 'driverDetail.serviceVehicleTypes',
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
  ]

  return [
    ...(prematch.$match ? [prematch] : []),
    ...(userRole === EUserRole.CUSTOMER ? forBusinessCustomer : []),
    ...(userRole === EUserRole.DRIVER ? forDriver : []),
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
    ...userPipelineStage('user'),
    ...userPipelineStage('approvalBy'),
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
