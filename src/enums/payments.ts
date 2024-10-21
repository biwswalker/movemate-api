import { registerEnumType } from 'type-graphql'

export enum EPaymentMethod {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}
registerEnumType(EPaymentMethod, {
  name: 'EPaymentMethod',
  description: 'Payment method',
})

export enum EPaymentStatus {
  WAITING_CONFIRM_PAYMENT = 'WAITING_CONFIRM_PAYMENT',
  INVOICE = 'INVOICE',
  BILLED = 'BILLED',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  REFUND = 'REFUND',
  CANCELLED = 'CANCELLED',
}

registerEnumType(EPaymentStatus, {
  name: 'EPaymentStatus',
  description: 'Payment status',
})

// Not update in client
export enum EPaymentRejectionReason {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  UNABLE_VERIFY_EVIDENCE = 'UNABLE_VERIFY_EVIDENCE',
  OTHER = 'OTHER',
}
registerEnumType(EPaymentRejectionReason, {
  name: 'EPaymentRejectionReason',
  description: 'Payment rejection reason',
})