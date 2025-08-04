import { registerEnumType } from "type-graphql";

export enum ETransactionDriverStatus {
  ALL = 'ALL',
  NON_OUTSTANDING = 'NON_OUTSTANDING',
  PENDING = 'PENDING',
  OUTSTANDING = 'OUTSTANDING',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}
registerEnumType(ETransactionDriverStatus, {
  name: 'ETransactionDriverStatus',
  description: 'Transaction Driver Status',
})