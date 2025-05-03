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