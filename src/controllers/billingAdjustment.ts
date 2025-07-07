import { CreateAdjustmentNoteInput } from '@inputs/billingAdjustmentNote.input'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { generateTrackingNumber } from '@utils/string.utils'
import { format } from 'date-fns'
import { last, sortBy, sumBy } from 'lodash'
import BillingAdjustmentNoteModel, { BillingAdjustmentNote } from '@models/finance/billingAdjustmentNote.model'
import BillingModel from '@models/finance/billing.model'
import { User } from '@models/user.model'
import { Invoice } from '@models/finance/invoice.model'
import { EAdjustmentNoteType } from '@enums/billing'
import { EUserType } from '@enums/users'
import { generateAdjustmentNote } from 'reports/adjustmentnote'
import { BillingDocument } from '@models/finance/documents.model'
import PaymentModel, { Payment } from '@models/finance/payment.model'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'

export async function createAdjustmentNote(
  input: CreateAdjustmentNoteInput,
  adminId: string,
  session?: ClientSession,
): Promise<{ adjustmentNote: BillingAdjustmentNote; document: BillingDocument; fileName: string; filePath: string }> {
  const { billingId, adjustmentType, items, issueDate, remarks } = input

  const billing = await BillingModel.findById(billingId)
    .populate(['user', 'invoice', 'adjustmentNotes'])
    .session(session)
  if (!billing || !billing.user) throw new GraphQLError('ไม่พบข้อมูล Billing หรือ User')

  const customer = billing.user as User

  // --- 1. หายอดล่าสุด (Previous State) ---
  const lastAdjustmentNote = last(sortBy(billing.adjustmentNotes, 'issueDate')) as BillingAdjustmentNote | undefined

  let originalSubTotal = 0 // มูลค่าตามใบแจ้งหนี้เดิม
  let previousDocumentRef: { documentNumber: string; documentType: string }

  if (lastAdjustmentNote) {
    // ถ้ามี Note อยู่แล้ว ใช้ยอดจาก Note ล่าสุด
    originalSubTotal = lastAdjustmentNote.newSubTotal
    previousDocumentRef = {
      documentNumber: lastAdjustmentNote.adjustmentNumber,
      documentType: lastAdjustmentNote.adjustmentType,
    }
  } else if (billing.invoice) {
    // ถ้ายังไม่มี Note ใช้ยอดจาก Invoice
    const invoice = billing.invoice as Invoice
    originalSubTotal = invoice.subTotal
    previousDocumentRef = {
      documentNumber: invoice.invoiceNumber,
      documentType: 'INVOICE',
    }
  } else {
    throw new GraphQLError('ไม่พบเอกสารอ้างอิงเริ่มต้น (Invoice)')
  }

  // --- 2. คำนวณยอดใหม่และภาษี ---
  const adjustmentSubTotal = sumBy(items, 'amount') // ผลต่าง
  const newSubTotal =
    adjustmentType === EAdjustmentNoteType.DEBIT_NOTE
      ? originalSubTotal + adjustmentSubTotal
      : originalSubTotal - adjustmentSubTotal

  const newTaxAmount = customer.userType === EUserType.BUSINESS && newSubTotal > 1000 ? newSubTotal * 0.01 : 0 // ภาษีหัก ณ ที่จ่าย 1%
  const newTotalAmount = newSubTotal - newTaxAmount // รวมที่ต้องชำระทั้งสิ้น

  // --- 3. สร้างและบันทึกเอกสาร ---
  const prefix = adjustmentType === EAdjustmentNoteType.DEBIT_NOTE ? 'DR' : 'CR'
  const idType: TGenerateIDType = adjustmentType === EAdjustmentNoteType.DEBIT_NOTE ? 'debitnote' : 'creditnote'
  const today = new Date()
  const generateMonth = format(today, 'yyMM')
  const adjustmentNumber = await generateTrackingNumber(`${prefix}${generateMonth}`, idType, 3)
  const newAdjustmentNote = new BillingAdjustmentNoteModel({
    adjustmentNumber,
    billing: billing._id,
    adjustmentType,
    items,
    issueDate: issueDate || new Date(),
    remarks,
    createdBy: adminId,
    previousDocumentRef,
    originalSubTotal,
    adjustmentSubTotal,
    newSubTotal,
    taxAmount: newTaxAmount, // <-- บันทึกยอดภาษีใหม่
    totalAmount: newTotalAmount,
  })

  await newAdjustmentNote.save({ session })

  const lastestPayment = last(sortBy(billing.payments, 'createdAt')) as Payment | undefined
  if (lastestPayment) {
    if (lastestPayment.status === EPaymentStatus.PENDING) {
      await PaymentModel.findByIdAndUpdate(lastestPayment._id, { status: EPaymentStatus.CANCELLED }, { session })
    }
  }

  const _paymentNumber = await generateTrackingNumber(`PAYCAS${generateMonth}`, 'payment', 3)

  const _payment = new PaymentModel({
    quotations: [],
    paymentMethod: EPaymentMethod.CREDIT,
    paymentNumber: _paymentNumber,
    status: EPaymentStatus.PENDING,
    type: EPaymentType.PAY,
    subTotal: newAdjustmentNote.newSubTotal,
    tax: newAdjustmentNote.taxAmount,
    total: newAdjustmentNote.totalAmount,
  })

  await _payment.save({ session })

  // 4. อัปเดต Billing เดิมให้มี Reference ไปยัง Note ใหม่
  await billing.updateOne({ $push: { adjustmentNotes: newAdjustmentNote._id, payments: _payment._id } }, { session })

  const _billing = await BillingModel.findById(billing._id).session(session)

  const { document, fileName, filePath } = await generateAdjustmentNote(_billing, newAdjustmentNote, session)

  // อัปเดต adjustmentNote ให้มี reference ไปยัง document ที่สร้างขึ้น (ต้องเพิ่ม field ใน model)
  const _adjustmentNote = await BillingAdjustmentNoteModel.findByIdAndUpdate(
    newAdjustmentNote._id,
    { document: document._id },
    { session, new: true },
  )

  console.log(`สร้าง ${adjustmentType} (${adjustmentNumber}) สำหรับ Billing ID: ${billingId} สำเร็จ`)

  return { adjustmentNote: _adjustmentNote, document, fileName, filePath }
}
