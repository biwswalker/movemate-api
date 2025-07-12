import { registerEnumType } from 'type-graphql'

export enum EShipmentStatus {
  IDLE = 'IDLE',
  PROGRESSING = 'PROGRESSING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUND = 'REFUND',
}
registerEnumType(EShipmentStatus, {
  name: 'EShipmentStatus',
  description: 'Shiping status',
})

export enum EAdminAcceptanceStatus {
  PENDING = 'PENDING',
  REACH = 'REACH',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
registerEnumType(EAdminAcceptanceStatus, {
  name: 'EAdminAcceptanceStatus',
  description: 'Admin acceptance status',
})

export enum EDriverAcceptanceStatus {
  IDLE = 'IDLE',
  ASSIGN = 'ASSIGN',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  UNINTERESTED = 'UNINTERESTED',
}
registerEnumType(EDriverAcceptanceStatus, {
  name: 'EDriverAcceptanceStatus',
  description: 'Driver acceptance status',
})

export enum EShipmentCancellationReason {
  LOST_ITEM = 'LOST_ITEM',
  INCOMPLETE_INFO = 'INCOMPLETE_INFO',
  RECIPIENT_UNAVAILABLE = 'RECIPIENT_UNAVAILABLE',
  BOOKING_ISSUE = 'BOOKING_ISSUE',
  VEHICLE_ISSUE = 'VEHICLE_ISSUE',
  DRIVER_CANCELLED = 'DRIVER_CANCELLED',
  DELAYED_SHIPMENT = 'DELAYED_SHIPMENT',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  PACKING_ERROR = 'PACKING_ERROR',
  MANAGEMENT_DECISION = 'MANAGEMENT_DECISION',
  OTHER = 'OTHER',
}
registerEnumType(EShipmentCancellationReason, {
  name: 'EShipmentCancellationReason',
  description: 'Shipment cancellation reason',
})

// Shipment Criteria
export enum EShipmentStatusCriteria {
  // Other
  ALL = 'ALL',
  IDLE = 'IDLE',
  PROGRESSING = 'PROGRESSING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUND = 'REFUND',
  // Admin
  PAYMENT_VERIFY = 'PAYMENT_VERIFY',
  WAITING_DRIVER = 'WAITING_DRIVER',
}
registerEnumType(EShipmentStatusCriteria, {
  name: 'EShipmentStatusCriteria',
  description: 'Shipment status criteria',
})

// Shipment Matching Criteria
export enum EShipmentMatchingCriteria {
  // Other
  NEW = 'NEW',
  PROGRESSING = 'PROGRESSING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}
registerEnumType(EShipmentMatchingCriteria, {
  name: 'EShipmentMatchingCriteria',
  description: 'Shipment matching status criteria',
})

enum EIssueType {
  DELAY = 'DELAY',
  DAMAGE = 'DAMAGE',
  MISSING = 'MISSING',
  OTHER = 'OTHER',
}

// Shipment Matching Criteria
export enum EQuotationStatus {
  ACTIVE = 'ACTIVE',
  VOID = 'VOID',
}
registerEnumType(EQuotationStatus, {
  name: 'EQuotationStatus',
  description: 'Quotation status',
})
