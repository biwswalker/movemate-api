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
  PENDING = 'PENDING',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED'
}

registerEnumType(EPaymentStatus, {
  name: 'EPaymentStatus',
  description: 'Payment status',
})

export enum EPaymentType {
  PAY = 'PAY',
  REFUND = 'REFUND',
  CHANGE = 'CHANGE',
}

registerEnumType(EPaymentType, {
  name: 'EPaymentType',
  description: 'Payment type',
})

// export enum _deprecated_EPaymentStatus {
//   WAITING_CONFIRM_PAYMENT = 'WAITING_CONFIRM_PAYMENT',
//   INVOICE = 'INVOICE',
//   BILLED = 'BILLED',
//   PAID = 'PAID',
//   REFUNDED = 'REFUNDED',
//   REFUND = 'REFUND',
//   CANCELLED = 'CANCELLED',
// }

// registerEnumType(_deprecated_EPaymentStatus, {
//   name: 'EPaymentStatus',
//   description: 'Payment status',
// })

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

export enum EQRPaymentType {
  MOBILE_NUMBER = 'MSISDN',
  NATIONAL_ID = 'NATID',
  EWALLET_ID = 'EWALLETID',
  BANK_ACCOUNT = 'BANKACC',
}
registerEnumType(EQRPaymentType, {
  name: 'EQRPaymentType',
  description: 'Payment type to generate each type code',
})
