import { GetUserArgs } from '@inputs/user.input' // ตรวจสอบว่า import มาจาก path ที่ถูกต้อง
import { isEmpty } from 'lodash'
import { PipelineStage, Types } from 'mongoose'
import {
  EUserCriterialStatus,
  EUserCriterialType,
  EUserRole,
  EUserStatus,
  EUserType,
  EUserValidationStatus,
} from '@enums/users'

// Helper function เพื่อสร้าง regex match สำหรับชื่อ
const buildNameMatch = (name: string) => {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Sanitize regex
  return {
    $or: [
      { 'individualDetail.firstname': { $regex: safeName, $options: 'i' } },
      { 'individualDetail.lastname': { $regex: safeName, $options: 'i' } },
      { 'businessDetail.businessName': { $regex: safeName, $options: 'i' } },
      // เพิ่มการค้นหาจาก fullname ของ driver ด้วย
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$driverDetail.firstname', ' ', '$driverDetail.lastname'] },
            regex: safeName,
            options: 'i',
          },
        },
      },
    ],
  }
}

export const GET_USER_LIST = (filters: GetUserArgs, sort = {}): PipelineStage[] => {
  const matchConditions: any = {}
  const postLookupMatchConditions: any = {}
  let sortStage: any = {}

  if (isEmpty(sort)) {
    sortStage['validationStatusWeight'] = 1 // เรียงตามวันที่สร้างล่าสุด
    sortStage['statusWeight'] = 1 // เรียงตามวันที่สร้างล่าสุด
    sortStage['createdAt'] = -1 // เรียงตามวันที่สร้างล่าสุด
  } else {
    sortStage = sort
  }

  // --- 1. สร้างเงื่อนไขการกรอง (Filter) จาก GetUserArgs ---
  if (filters._id) matchConditions._id = new Types.ObjectId(filters._id)
  if (filters.userNumber) matchConditions.userNumber = { $regex: filters.userNumber, $options: 'i' }
  if (filters.username) matchConditions.username = { $regex: filters.username, $options: 'i' }
  if (filters.userRole) matchConditions.userRole = filters.userRole
  if (filters.validationStatus) matchConditions.validationStatus = filters.validationStatus

  // จัดการ status filter (ALL, ACTIVE, INACTIVE)
  if (filters.status && filters.status !== EUserCriterialStatus.ALL) {
    matchConditions.status = filters.status
  }
  // จัดการ userType filter
  if (filters.userType && filters.userType !== EUserCriterialType.ALL) {
    if (filters.isUpgradeRequest === true && filters.userType === EUserCriterialType.BUSINESS) {
      // --- ถ้าเงื่อนไขเป็นจริง, ให้ใช้ Filter สำหรับค้นหาลูกค้ารออัปเกรด ---
      matchConditions['$or'] = [
        {
          userType: EUserType.INDIVIDUAL,
          upgradeRequest: { $exists: true, $ne: null },
          validationStatus: EUserValidationStatus.PENDING,
        },
        { userType: EUserType.BUSINESS },
      ]
    } else {
      matchConditions.userType = filters.userType
    }
  }

  // เงื่อนไขที่ต้องกรองหลัง lookup
  if (filters.email) {
    postLookupMatchConditions['$or'] = [
      { 'individualDetail.email': { $regex: filters.email, $options: 'i' } },
      { 'businessDetail.businessEmail': { $regex: filters.email, $options: 'i' } },
      { 'upgradeRequest.businessEmail': { $regex: filters.email, $options: 'i' } },
    ]
  }
  if (filters.phoneNumber) {
    postLookupMatchConditions['$or'] = [
      { 'individualDetail.phoneNumber': { $regex: filters.phoneNumber, $options: 'i' } },
      { 'businessDetail.contactNumber': { $regex: filters.phoneNumber, $options: 'i' } },
      { 'upgradeRequest.contactNumber': { $regex: filters.phoneNumber, $options: 'i' } },
      { 'driverDetail.phoneNumber': { $regex: filters.phoneNumber, $options: 'i' } },
    ]
  }
  if (filters.taxId) {
    postLookupMatchConditions['$or'] = [
      { 'individualDetail.taxId': { $regex: filters.taxId, $options: 'i' } },
      { 'businessDetail.taxNumber': { $regex: filters.taxId, $options: 'i' } },
      { 'upgradeRequest.taxNumber': { $regex: filters.taxId, $options: 'i' } },
      { 'driverDetail.taxNumber': { $regex: filters.taxId, $options: 'i' } },
    ]
  }
  if (filters.lineId) {
    postLookupMatchConditions['driverDetail.lineId'] = { $regex: filters.lineId, $options: 'i' }
  }
  if (filters.serviceVehicleType) {
    postLookupMatchConditions['driverDetail.serviceVehicleTypes'] = new Types.ObjectId(filters.serviceVehicleType)
  }

  if (filters.parentId) {
    postLookupMatchConditions['$or'] = [
      { parents: { $in: [filters.parentId] } },
      { requestedParents: { $in: [filters.parentId] } },
      { rejectedRequestParents: { $in: [filters.parentId] } },
    ]
  }

  const pipeline: PipelineStage[] = [
    // --- 2. $match ขั้นแรก (กรอง field ที่อยู่ใน User collection โดยตรง) ---
    ...(isEmpty(matchConditions) ? [] : [{ $match: matchConditions }]),

    // --- 3. $lookup ข้อมูล Detail ทั้งหมด ---
    {
      $lookup: {
        from: 'individualcustomers',
        localField: 'individualDetail',
        foreignField: '_id',
        as: 'individualDetail',
      },
    },
    { $unwind: { path: '$individualDetail', preserveNullAndEmptyArrays: true } },
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
          { $unwind: { path: '$creditPayment', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'businesscustomercashpayments',
              localField: 'cashPayment',
              foreignField: '_id',
              as: 'cashPayment',
            },
          },
          { $unwind: { path: '$cashPayment', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: '$businessDetail', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'driverdetails', localField: 'driverDetail', foreignField: '_id', as: 'driverDetail' } },
    { $unwind: { path: '$driverDetail', preserveNullAndEmptyArrays: true } },
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
          { $unwind: { path: '$creditPayment', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'businesscustomercashpayments',
              localField: 'cashPayment',
              foreignField: '_id',
              as: 'cashPayment',
            },
          },
          { $unwind: { path: '$cashPayment', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: '$upgradeRequest', preserveNullAndEmptyArrays: true } },

    // --- 4. $match ขั้นที่สอง (กรอง field ที่อยู่ใน Detail) ---
    ...(filters.name ? [{ $match: buildNameMatch(filters.name) }] : []),
    ...(isEmpty(postLookupMatchConditions) ? [] : [{ $match: postLookupMatchConditions }]),

    // --- 5. $addFields เพื่อสร้าง 'title' และ field อื่นๆ ที่จำเป็น ---
    {
      $addFields: {
        title: {
          $cond: {
            if: {
              $and: [
                { $eq: [filters.isUpgradeRequest, true] },
                { $eq: [filters.userType, EUserCriterialType.BUSINESS] },
                { $eq: ['$userType', EUserType.INDIVIDUAL] },
              ],
            },
            then: '$upgradeRequest.businessTitle',
            else: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$userRole', EUserRole.DRIVER] },
                    then: {
                      $cond: {
                        if: { $eq: ['$driverDetail.title', 'อื่นๆ'] },
                        then: '$driverDetail.otherTitle',
                        else: '$driverDetail.title',
                      },
                    },
                  },
                  {
                    case: { $eq: ['$userType', EUserType.INDIVIDUAL] },
                    then: {
                      $cond: {
                        if: { $eq: ['$individualDetail.title', 'อื่นๆ'] },
                        then: '$individualDetail.otherTitle',
                        else: '$individualDetail.title',
                      },
                    },
                  },
                  {
                    case: { $eq: ['$userType', EUserType.BUSINESS] },
                    then: '$businessDetail.businessTitle',
                  },
                ],
                default: '',
              },
            },
          },
        },
        fullName: {
          $cond: {
            // ถ้าเป็น query หาลูกค้ารออัปเกรด
            if: {
              $and: [
                { $eq: [filters.isUpgradeRequest, true] },
                { $eq: [filters.userType, EUserCriterialType.BUSINESS] },
                { $eq: ['$userType', EUserType.INDIVIDUAL] },
              ],
            },
            // ให้ใช้ชื่อจาก upgradeRequest
            then: '$upgradeRequest.businessName',
            // มิฉะนั้นใช้ Logic เดิม
            else: {
              $switch: {
                branches: [
                  { case: { $eq: ['$userType', EUserType.BUSINESS] }, then: '$businessDetail.businessName' },
                  {
                    case: { $eq: ['$userRole', EUserRole.DRIVER] },
                    then: { $concat: ['$driverDetail.firstname', ' ', '$driverDetail.lastname'] },
                  },
                ],
                default: { $concat: ['$individualDetail.firstname', ' ', '$individualDetail.lastname'] },
              },
            },
          },
        },
        statusWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', EUserStatus.PENDING] }, then: 0 },
              { case: { $eq: ['$status', EUserStatus.ACTIVE] }, then: 1 },
              { case: { $eq: ['$status', EUserStatus.INACTIVE] }, then: 2 },
              { case: { $eq: ['$status', EUserStatus.BANNED] }, then: 3 },
              { case: { $eq: ['$status', EUserStatus.DENIED] }, then: 4 },
            ],
            default: 99,
          },
        },
        validationStatusWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$validationStatus', EUserValidationStatus.PENDING] }, then: 0 },
              { case: { $eq: ['$validationStatus', EUserValidationStatus.IDLE] }, then: 1 },
              { case: { $eq: ['$validationStatus', EUserValidationStatus.APPROVE] }, then: 2 },
              { case: { $eq: ['$validationStatus', EUserValidationStatus.DENIED] }, then: 3 },
            ],
            default: 99,
          },
        },
      },
    },
    // --- 6. $project เพื่อเลือกและจัดรูปแบบ field สุดท้าย ---
    {
      $project: {
        _id: 1,
        userNumber: 1,
        userRole: 1,
        userType: 1,
        username: 1,
        status: 1,
        validationStatus: 1,
        isVerifiedEmail: 1,
        isVerifiedPhoneNumber: 1,
        createdAt: 1,
        title: 1,
        fullName: 1,
        validationStatusWeight: 1,
        statusWeight: 1,
        email: {
          $cond: {
            if: { $eq: ['$userType', EUserType.BUSINESS] },
            then: '$businessDetail.businessEmail',
            else: '$individualDetail.email',
          },
        },
        contactNumber: {
          $cond: {
            if: { $eq: ['$userType', EUserType.BUSINESS] },
            then: '$businessDetail.contactNumber',
            else: '$individualDetail.phoneNumber',
          },
        },
        paymentMethod: {
          $cond: {
            if: { $eq: ['$userType', EUserType.BUSINESS] },
            then: '$businessDetail.paymentMethod',
            else: '$individualDetail.paymentMethod', // สมมติว่าลูกค้าบุคคลมี field นี้
          },
        },
        creditLimit: '$businessDetail.creditPayment.creditLimit',
        creditUsage: '$businessDetail.creditPayment.creditUsage',
      },
    },
    {
      $sort: sortStage,
    },
  ]
  return pipeline
}
