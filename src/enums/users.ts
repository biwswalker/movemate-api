import { registerEnumType } from 'type-graphql'

export enum EUserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  DRIVER = 'driver',
}
registerEnumType(EUserRole, {
  name: 'EUserRole',
  description: 'User role',
})

export enum EUserType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}
registerEnumType(EUserType, {
  name: 'EUserType',
  description: 'User type',
})

export enum EUserStatus {
  PENDING = 'pending', // Need to Verify
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  DENIED = 'denied',
}
registerEnumType(EUserStatus, {
  name: 'EUserStatus',
  description: 'User status',
})

export enum EUserValidationStatus {
  PENDING = 'pending',
  APPROVE = 'approve',
  DENIED = 'denied',
}
registerEnumType(EUserValidationStatus, {
  name: 'EUserValidationStatus',
  description: 'User validation status',
})

export enum ERegistration {
  WEB = 'web',
  APP = 'app',
}
registerEnumType(ERegistration, {
  name: 'ERegistration',
  description: 'Registration type',
})

export enum EDriverStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  WORKING = 'working',
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
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  OWNER = 'owner',
}
registerEnumType(EAdminPermission, {
  name: 'EAdminPermission',
  description: 'Admin permission',
})
