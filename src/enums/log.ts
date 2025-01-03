import { registerEnumType } from 'type-graphql'

export enum ELogRefType {
  SHIPMENT = 'SHIPMENT',
  PAYMENT = 'PAYMENT',
}

registerEnumType(ELogRefType, {
  name: 'ELogRefType',
  description: 'Log ref type',
})
