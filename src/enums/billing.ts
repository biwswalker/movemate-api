import { registerEnumType } from 'type-graphql'

export enum EAdjustmentNoteType {
  DEBIT_NOTE = 'DEBIT_NOTE', // ใบเพิ่มหนี้
  CREDIT_NOTE = 'CREDIT_NOTE', // ใบลดหนี้
}
registerEnumType(EAdjustmentNoteType, {
  name: 'EAdjustmentNoteType',
  description: 'Adjustment Note Type',
})

export enum EBillingStatus {
  PENDING = 'PENDING',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}
registerEnumType(EBillingStatus, {
  name: 'EBillingStatus',
  description: 'Billing status',
})

export enum EBillingState {
  CURRENT = 'CURRENT',
  OVERDUE = 'OVERDUE',
  REFUND = 'REFUND',
}
registerEnumType(EBillingState, {
  name: 'EBillingState',
  description: 'Billing state',
})

export enum EBillingReason {
  CANCELLED_SHIPMENT = 'CANCELLED_SHIPMENT',
  REJECTED_PAYMENT = 'REJECTED_PAYMENT',
  REFUND_PAYMENT = 'REFUND_PAYMENT',
  NOREFUND_PAYMENT = 'NOREFUND_PAYMENT',
}
registerEnumType(EBillingReason, {
  name: 'EBillingReason',
  description: 'Billing reason',
})

export enum EBillingCriteriaStatus {
  ALL = 'ALL',
  PENDING = 'PENDING',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}
registerEnumType(EBillingCriteriaStatus, {
  name: 'EBillingCriteriaStatus',
  description: 'Billing criteria status',
})

export enum EBillingCriteriaState {
  ALL = 'ALL',
  CURRENT = 'CURRENT',
  OVERDUE = 'OVERDUE',
  REFUND = 'REFUND',
}
registerEnumType(EBillingCriteriaState, {
  name: 'EBillingCriteriaState',
  description: 'Billing criteria state',
})

export enum EBillingPaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}
registerEnumType(EBillingPaymentStatus, {
  name: 'EBillingPaymentStatus',
  description: 'Billing payment status',
})

export enum EPriceItemType {
  SHIPPING = 'SHIPPING',
  RETURN = 'RETURN',
  SERVICES = 'SERVICES',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
}
registerEnumType(EPriceItemType, {
  name: 'EPriceItemType',
  description: 'Price item type',
})
