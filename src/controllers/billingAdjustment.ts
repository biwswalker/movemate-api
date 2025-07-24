import { CreateAdjustmentNoteInput } from '@inputs/billingAdjustmentNote.input'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { generateMonthlySequenceNumber, generateTrackingNumber } from '@utils/string.utils'
import { format } from 'date-fns'
import { find, last, sortBy, sumBy } from 'lodash'
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
  const { billingId, adjustmentType, items, remarks } = input

  const billing = await BillingModel.findById(billingId)
    .populate(['user', 'invoice', 'adjustmentNotes'])
    .session(session)
  if (!billing || !billing.user) throw new GraphQLError('ไม่พบข้อมูล Billing หรือ User')

  const customer = billing.user as User
  const invoice = billing.invoice as Invoice
  const existingNotes = sortBy(billing.adjustmentNotes, 'issueDate')
  const lastNote = last(existingNotes) as BillingAdjustmentNote | undefined

  let adjustmentNumber: string
  let issueDate: Date

  if (lastNote && lastNote.adjustmentType === adjustmentType) {
    // ---- กรณีที่ 1: สร้างประเภทเดียวกับใบล่าสุด ----
    // ให้ใช้ข้อมูลจาก "ใบแรกสุด" ของประเภทนั้น
    const firstNoteOfSameType = find(existingNotes, { adjustmentType }) as BillingAdjustmentNote
    adjustmentNumber = firstNoteOfSameType!.adjustmentNumber
    issueDate = firstNoteOfSameType!.issueDate
  } else {
    // ---- กรณีที่ 2: เป็นใบแรก หรือ สร้างคนละประเภทกับใบล่าสุด ----
    const firstNoteOfNewType = find(existingNotes, { adjustmentType }) as BillingAdjustmentNote | undefined
    if (firstNoteOfNewType) {
      // 2.1) ถ้าเคยมีประเภทนี้อยู่แล้ว ให้ใช้ข้อมูลจากใบแรกสุดของประเภทนั้น
      adjustmentNumber = firstNoteOfNewType.adjustmentNumber
      issueDate = firstNoteOfNewType.issueDate
    } else {
      // 2.2) ถ้าไม่เคยมีประเภทนี้เลย ให้สร้างใหม่ทั้งหมด
      const idType: TGenerateIDType = adjustmentType === EAdjustmentNoteType.DEBIT_NOTE ? 'debitnote' : 'creditnote'
      adjustmentNumber = await generateMonthlySequenceNumber(idType)
      issueDate = input.issueDate || new Date()
    }
  }

  // --- 2. หายอดล่าสุด (Previous State) ---
  let previousSubTotal = 0
  let previousDocumentRef: { documentNumber: string; documentType: string }

  if (lastNote && lastNote.adjustmentType !== adjustmentType) {
    // อ้างอิงจากใบปรับปรุงล่าสุด ถ้าสร้างคนละประเภท
    previousSubTotal = lastNote.newSubTotal
    previousDocumentRef = { documentNumber: lastNote.adjustmentNumber, documentType: lastNote.adjustmentType }
  } else {
    // อ้างอิงจาก Invoice ถ้าเป็นใบแรก หรือสร้างประเภทเดียวกัน
    if (lastNote) {
      previousSubTotal = lastNote.originalSubTotal
      previousDocumentRef = { documentNumber: lastNote.adjustmentNumber, documentType: lastNote.adjustmentType }
    } else {
      previousSubTotal = invoice.subTotal
      previousDocumentRef = { documentNumber: invoice.invoiceNumber, documentType: 'INVOICE' }
    }
  }

  const adjustmentAmount = sumBy(items, 'amount')
  const newSubTotal =
    adjustmentType === EAdjustmentNoteType.DEBIT_NOTE
      ? previousSubTotal + adjustmentAmount
      : previousSubTotal - adjustmentAmount
  const newTax = customer.userType === EUserType.BUSINESS ? newSubTotal * 0.01 : 0
  const newTotalAmount = newSubTotal - newTax

  const newAdjustmentNote = new BillingAdjustmentNoteModel({
    adjustmentNumber,
    billing: billing._id,
    adjustmentType,
    items,
    issueDate,
    remarks,
    createdBy: adminId,
    previousDocumentRef,
    originalSubTotal: previousSubTotal,
    adjustmentSubTotal: adjustmentAmount,
    newSubTotal,
    taxAmount: newTax,
    totalAmount: newTotalAmount,
  })

  await newAdjustmentNote.save({ session })

  const lastestPayment = last(sortBy(billing.payments, 'createdAt')) as Payment | undefined
  if (lastestPayment) {
    if (lastestPayment.status === EPaymentStatus.PENDING) {
      await PaymentModel.findByIdAndUpdate(lastestPayment._id, { status: EPaymentStatus.CANCELLED }, { session })
    }
  }

  const today = new Date()
  const generateMonth = format(today, 'yyMM')
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
