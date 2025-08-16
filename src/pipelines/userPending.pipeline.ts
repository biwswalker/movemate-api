import { EUserCriterialType, EUserRole, EUserType } from '@enums/users'
import { GetUserPendingListInput } from '@inputs/user.input'
import { PipelineStage, Types } from 'mongoose'
import { isEmpty } from 'lodash'
import { endOfDay, startOfDay } from 'date-fns'

// Helper function เพื่อสร้าง regex match สำหรับชื่อ (ปรับปรุงให้ใช้กับ user ที่ join เข้ามา)
const buildPendingUserNameMatch = (name: string) => {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return {
    $or: [
      { 'user.individualDetail.firstname': { $regex: safeName, $options: 'i' } },
      { 'user.individualDetail.lastname': { $regex: safeName, $options: 'i' } },
      { 'user.businessDetail.businessName': { $regex: safeName, $options: 'i' } },
    ],
  }
}

export const GET_PEDNING_USER_LIST = (filters: Partial<GetUserPendingListInput> = {}, sort = {}) => {
  const prematch: any = {} // Match ที่จะทำบน UserPendingModel
  const postmatch: any = {} // Match ที่จะทำหลัง join User

  // ## Filters สำหรับ UserPendingModel (prematch) ##
  if (filters.status) prematch.status = filters.status
  if (filters.userId) prematch.userId = new Types.ObjectId(filters.userId)
  // เพิ่ม Filter ตามช่วงวันที่ร้องขอ (requestStart, requestEnd)
  if (filters.requestStart || filters.requestEnd) {
    prematch.createdAt = {}
    if (filters.requestStart) prematch.createdAt.$gte = startOfDay(new Date(filters.requestStart))
    if (filters.requestEnd) prematch.createdAt.$lte = endOfDay(new Date(filters.requestEnd))
  }
  // ## Filters สำหรับ User Collection (postmatch) ##
  if (filters.userNumber) postmatch['user.userNumber'] = { $regex: filters.userNumber, $options: 'i' }
  if (filters.username) postmatch['user.username'] = { $regex: filters.username, $options: 'i' }
  if (filters.userRole) postmatch['user.userRole'] = filters.userRole
  if (filters.userType && filters.userType !== EUserCriterialType.ALL) {
    postmatch['user.userType'] = filters.userType
  }

  // สร้าง $or condition สำหรับ field ที่อาจอยู่ได้หลายที่
  const orConditions = []
  if (filters.email) {
    orConditions.push({ 'user.individualDetail.email': { $regex: filters.email, $options: 'i' } })
    orConditions.push({ 'user.businessDetail.businessEmail': { $regex: filters.email, $options: 'i' } })
  }
  if (filters.phoneNumber) {
    orConditions.push({ 'user.individualDetail.phoneNumber': { $regex: filters.phoneNumber, $options: 'i' } })
    orConditions.push({ 'user.businessDetail.contactNumber': { $regex: filters.phoneNumber, $options: 'i' } })
  }
  if (filters.taxId) {
    orConditions.push({ 'user.individualDetail.taxId': { $regex: filters.taxId, $options: 'i' } })
    orConditions.push({ 'user.businessDetail.taxNumber': { $regex: filters.taxId, $options: 'i' } })
  }
  if (orConditions.length > 0) {
    postmatch.$or = orConditions
  }
  const pipeline: PipelineStage[] = [
    ...(isEmpty(prematch) ? [] : [{ $match: prematch }]),

    // --- 3. Lookup ที่จำเป็น ---
    {
      $addFields: {
        userObjectId: { $toObjectId: '$userId' }, // แปลง userId -> userObjectId
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userObjectId', // ใช้ field ที่เป็น ObjectId
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'approvalBy',
        foreignField: '_id',
        as: 'approveByInfo',
        pipeline: [
          { $lookup: { from: 'admins', localField: 'adminDetail', foreignField: '_id', as: 'adminDetailInfo' } },
          { $unwind: { path: '$adminDetailInfo', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    {
      $lookup: {
        from: 'files',
        localField: 'profileImage',
        foreignField: '_id',
        as: 'profileImageInfo',
      },
    },
    { $unwind: { path: '$profileImageInfo', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$approveByInfo', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'individualcustomers',
        localField: 'user.individualDetail',
        foreignField: '_id',
        as: 'user.individualDetail',
      },
    },
    { $unwind: { path: '$user.individualDetail', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'businesscustomers',
        localField: 'user.businessDetail',
        foreignField: '_id',
        as: 'user.businessDetail',
      },
    },
    { $unwind: { path: '$user.businessDetail', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'driverdetails',
        localField: 'user.driverDetail',
        foreignField: '_id',
        as: 'user.driverDetail',
        pipeline: [
          {
            $lookup: {
              from: 'vehicletypes',
              localField: 'serviceVehicleTypes',
              foreignField: '_id',
              as: 'serviceVehicleTypesInfo',
            },
          },
        ],
      },
    },
    { $unwind: { path: '$user.driverDetail', preserveNullAndEmptyArrays: true } },

    // --- 4. กรองข้อมูลเพิ่มเติมหลัง Join ---
    ...(isEmpty(postmatch) ? [] : [{ $match: postmatch }]),
    ...(filters.name ? [{ $match: buildPendingUserNameMatch(filters.name) }] : []),

    // --- 5. Project field สุดท้ายที่ต้องการเท่านั้น ---
    {
      $project: {
        _id: 1,
        userNumber: '$user.userNumber',
        title: {
          $switch: {
            branches: [
              // กรณีที่เป็น Driver
              {
                case: { $eq: ['$user.userRole', EUserRole.DRIVER] },
                then: { $ifNull: ['$user.driverDetail.title', ''] },
              },
              // กรณีที่เป็นลูกค้า Business
              {
                case: { $eq: ['$user.userType', EUserType.BUSINESS] },
                then: { $ifNull: ['$user.businessDetail.businessTitle', ''] },
              },
              // กรณีที่เป็นลูกค้า Individual
              {
                case: { $eq: ['$user.userType', EUserType.INDIVIDUAL] },
                then: { $ifNull: ['$user.individualDetail.title', ''] },
              },
            ],
            default: '',
          },
        },
        fullName: {
          $switch: {
            branches: [
              // กรณีที่เป็น Driver
              {
                case: { $eq: ['$user.userRole', EUserRole.DRIVER] },
                then: {
                  // ตรวจสอบ driverType
                  $cond: {
                    if: { $eq: ['$user.userType', EUserType.BUSINESS] },
                    then: '$user.driverDetail.businessName',
                    else: {
                      $concat: [
                        { $ifNull: ['$user.driverDetail.firstname', ''] },
                        ' ',
                        { $ifNull: ['$user.driverDetail.lastname', ''] },
                      ],
                    },
                  },
                },
              },
              // กรณีที่เป็นลูกค้า Business
              {
                case: { $eq: ['$user.userType', EUserType.BUSINESS] },
                then: '$user.businessDetail.businessName',
              },
            ],
            // Default คือลูกค้า Individual
            default: {
              $concat: [
                { $ifNull: ['$user.individualDetail.firstname', ''] },
                ' ',
                { $ifNull: ['$user.individualDetail.lastname', ''] },
              ],
            },
          },
        },
        email: {
          $switch: {
            branches: [
              { case: { $eq: ['$user.userType', EUserType.BUSINESS] }, then: '$user.businessDetail.businessEmail' },
            ],
            default: '$user.individualDetail.email',
          },
        },
        userType: '$user.userType',
        contactNumber: {
          $switch: {
            branches: [
              // กรณีที่เป็น Driver
              {
                case: { $eq: ['$user.userRole', EUserRole.DRIVER] },
                then: '$user.driverDetail.phoneNumber',
              },
              // กรณีที่เป็นลูกค้า Business
              {
                case: { $eq: ['$user.userType', EUserType.BUSINESS] },
                then: '$user.businessDetail.contactNumber',
              },
            ],
            // Default คือลูกค้า Individual
            default: '$user.individualDetail.phoneNumber',
          },
        },
        status: '$status', // status จาก userpendingmodels
        approveBy: {
          $trim: {
            // ใช้ trim เพื่อตัดช่องว่าง περιτ
            input: {
              $concat: [
                { $ifNull: ['$approveByInfo.adminDetailInfo.firstname', ''] },
                ' ',
                { $ifNull: ['$approveByInfo.adminDetailInfo.lastname', ''] },
              ],
            },
          },
        },
        updatedAt: {
          $dateToString: {
            format: '%Y-%m-%dT%H:%M:%S.%LZ', // รูปแบบมาตรฐาน ISO 8601
            date: '$updatedAt',
            timezone: 'Asia/Bangkok', // แนะนำให้ระบุ Timezone เพื่อความแม่นยำ
          },
        },
        businessBranch: { $ifNull: ['$user.businessDetail.businessBranch', ''] },
        profileImageName: { $ifNull: ['$profileImageInfo.filename', null] },
        driverType: { $ifNull: ['$user.driverDetail.driverType', null] },
        lineId: { $ifNull: ['$user.driverDetail.lineId', ''] },
        serviceVehicleTypeName: {
          $reduce: {
            input: '$user.driverDetail.serviceVehicleTypesInfo.name',
            initialValue: '',
            in: {
              $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this'],
            },
          },
        },
        licensePlateProvince: { $ifNull: ['$user.driverDetail.licensePlateProvince', ''] },
        licensePlateNumber: { $ifNull: ['$user.driverDetail.licensePlateNumber', ''] },
      },
    },
    {
      $sort: isEmpty(sort) ? { updatedAt: -1 } : sort,
    },
  ]

  return pipeline
}
