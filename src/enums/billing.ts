import { registerEnumType } from 'type-graphql'

export enum EAdjustmentNoteType {
  DEBIT_NOTE = 'DEBIT_NOTE', // ใบเพิ่มหนี้
  CREDIT_NOTE = 'CREDIT_NOTE', // ใบลดหนี้
}
registerEnumType(EAdjustmentNoteType, {
  name: 'EAdjustmentNoteType',
  description: 'Adjustment Note Type',
})
