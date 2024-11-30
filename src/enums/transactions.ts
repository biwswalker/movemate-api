import { registerEnumType } from "type-graphql";

export enum ETransactionDriverStatus {
  PENDING = 'PENDING',
  NON_OUTSTANDING = 'NON_OUTSTANDING',
  ALL = 'ALL',
}
registerEnumType(ETransactionDriverStatus, {
  name: 'ETransactionDriverStatus',
  description: 'Transaction Driver Status',
})
