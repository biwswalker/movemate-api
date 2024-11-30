import { registerEnumType } from 'type-graphql'

export enum EUserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}
registerEnumType(EUserRole, {
  name: 'EUserRole',
  description: 'User role',
})

export enum EUserType {
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
}
registerEnumType(EUserType, {
  name: 'EUserType',
  description: 'User type',
})

export enum EUserCriterialType {
  ALL = 'ALL',
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
}
registerEnumType(EUserCriterialType, {
  name: 'EUserCriterialType',
  description: 'User Criteria type',
})

export enum EUserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DENIED = 'DENIED',
}
registerEnumType(EUserStatus, {
  name: 'EUserStatus',
  description: 'User status',
})

export enum EUserCriterialStatus {
  ALL = 'ALL',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DENIED = 'DENIED',
}
registerEnumType(EUserCriterialStatus, {
  name: 'EUserCriterialStatus',
  description: 'User criteria status',
})

export enum EUserValidationStatus {
  PENDING = 'PENDING',
  APPROVE = 'APPROVE',
  DENIED = 'DENIED',
}
registerEnumType(EUserValidationStatus, {
  name: 'EUserValidationStatus',
  description: 'User validation status',
})

export enum ERegistration {
  WEB = 'WEB',
  APP = 'APP',
}
registerEnumType(ERegistration, {
  name: 'ERegistration',
  description: 'Registration type',
})

export enum EDriverStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  WORKING = 'WORKING',
}
registerEnumType(EDriverStatus, {
  name: 'EDriverStatus',
  description: 'Driver status',
})

export enum EDriverType {
  INDIVIDUAL_DRIVER = 'INDIVIDUAL_DRIVER',
  BUSINESS_DRIVER = 'BUSINESS_DRIVER',
  BUSINESS = 'BUSINESS',
}

registerEnumType(EDriverType, {
  name: 'EDriverType',
  description: 'Driver type',
})

export enum EAdminPermission {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OWNER = 'OWNER',
}
registerEnumType(EAdminPermission, {
  name: 'EAdminPermission',
  description: 'Admin permission',
})

export enum EUpdateUserStatus {
  PENDING = 'PENDING',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}
registerEnumType(EUpdateUserStatus, {
  name: 'EUpdateUserStatus',
  description: 'Update user status permission',
})
