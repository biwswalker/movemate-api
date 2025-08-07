import { registerEnumType } from "type-graphql";

export enum EReportType {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  BOOKING = 'BOOKING',
  DEBTOR = 'DEBTOR',
  CREDITOR = 'CREDITOR',
}
registerEnumType(EReportType, {
  name: 'EReportType',
  description: 'Report Type',
})

export enum ECustomerReportType {
  BOOKING = 'BOOKING',
}
registerEnumType(ECustomerReportType, {
  name: 'ECustomerReportType',
  description: 'Customer Report Type',
})