import { registerEnumType } from 'type-graphql'

export enum EServiceType {
  SERVICES = 'services',
  ACCESSORIES = 'accessories',
}
registerEnumType(EServiceType, {
  name: 'EServiceType',
  description: 'Service Type',
})

export enum EServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
registerEnumType(EServiceStatus, {
  name: 'EServiceStatus',
  description: 'Service status',
})
