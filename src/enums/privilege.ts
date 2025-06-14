import { registerEnumType } from 'type-graphql'

export enum EPrivilegeDiscountUnit {
  PERCENTAGE = 'PERCENTAGE',
  CURRENCY = 'CURRENCY',
}
registerEnumType(EPrivilegeDiscountUnit, {
  name: 'EPrivilegeDiscountUnit',
  description: 'Privilege discount unit',
})

export enum EPrivilegeStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
}
registerEnumType(EPrivilegeStatus, {
  name: 'EPrivilegeStatus',
  description: 'Privilege status',
})

export enum EPrivilegeStatusCriteria {
  ALL = 'ALL',
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
}
registerEnumType(EPrivilegeStatusCriteria, {
  name: 'EPrivilegeStatusCriteria',
  description: 'Privilege status criteria',
})