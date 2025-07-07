import PDFDocument from 'pdfkit-table'
import { ASSETS, FONTS } from './constants'
import { fDate } from '@utils/formatTime'
import { find, get, last, sortBy, toNumber } from 'lodash'
import { User } from '@models/user.model'
import { EPaymentMethod } from '@enums/payments'
import { EUserType } from '@enums/users'
import { Billing } from '@models/finance/billing.model'
import { Receipt } from '@models/finance/receipt.model'
import { Invoice } from '@models/finance/invoice.model'
import { BillingAdjustmentNote } from '@models/finance/billingAdjustmentNote.model'

type ReportType = 'invoice' | 'receipt' | 'debitnote' | 'creditnote'

function getTypeText(type: ReportType) {
  switch (type) {
    case 'invoice':
      return {
        uppercase: 'INVOICE',
        thai: 'ใบแจ้งหนี้',
      }
    case 'receipt':
      return {
        uppercase: 'RECEIPT',
        thai: 'ใบเสร็จรับเงิน',
      }
    case 'debitnote':
      return {
        uppercase: 'DEBIT NOTE',
        thai: 'ใบเพิ่มหนี้',
      }
    case 'creditnote':
      return {
        uppercase: 'CREDIT NOTE',
        thai: 'ใบลดหนี้',
      }
    default:
      return {
        uppercase: '',
        thai: '',
      }
  }
}

export function HeaderComponent(
  doc: PDFDocument,
  billing: Billing,
  type: ReportType,
  page: number,
  totalPage: number,
  isOriginal: boolean = true,
  targetId?: string,
) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight
  const isCreditPayment = billing.paymentMethod === EPaymentMethod.CREDIT
  // Logo
  doc.image(ASSETS.LOGO, doc.page.margins.left, 60, { width: 80 })

  // Company Movemate info
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(8).text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จํากัด', 110, 60)
  doc.font(FONTS.SARABUN_LIGHT).fontSize(7)
  doc.text('สาขา : (สำนักงานใหญ่)', 280, 61)
  doc.moveDown(0.8)
  doc.text('เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310', 110)
  doc.moveDown(0.6)
  doc.text('เลขประจําตัวผู้เสียภาษี: 0105564086723', 110)
  doc.moveDown(0.6)
  doc.text('ติดต่อ: 02-xxx-xxxx', 110)
  doc.moveDown(0.6)
  doc.text('อีเมล์: acc@movematethailand.com', 110)

  // Receipt number detail
  const docNumberReactX = 420
  const docNumberRectWidth = maxWidth - docNumberReactX

  doc.font(FONTS.SARABUN_REGULAR).fontSize(13).text(getTypeText(type).uppercase, docNumberReactX, 55, {
    align: 'center',
    width: docNumberRectWidth,
  })
  doc.moveDown(0.3)
  doc.font(FONTS.SARABUN_LIGHT).fontSize(9)
  doc.text(`${getTypeText(type).thai} ${isOriginal ? '(ต้นฉบับ)' : '(สำเนา)'}`, docNumberReactX, doc.y, {
    align: 'center',
    width: docNumberRectWidth,
  })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(docNumberReactX, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc.moveDown(0.5)
  if (isCreditPayment) {
    if (type === 'invoice') {
      const _invoice = billing.invoice as Invoice | undefined
      // 1
      doc.fontSize(8)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Invoice No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(_invoice.invoiceNumber, 499, doc.y - 10, { align: 'left' })

      // 2
      const issueInBEDateMonth = fDate(_invoice.invoiceDate, 'dd/MM')
      const issueInBEYear = toNumber(fDate(_invoice.invoiceDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(`${issueInBEDateMonth}/${issueInBEYear}`, 499, doc.y - 10, { align: 'left' })

      // 3
      const duedateInBEDateMonth = fDate(billing.paymentDueDate, 'dd/MM')
      const duedateInBEYear = toNumber(fDate(billing.paymentDueDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Due Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(`${duedateInBEDateMonth}/${duedateInBEYear}`, 499, doc.y - 10, { align: 'left' })
    } else if (type === 'receipt') {
      // ---
      const _receipts = billing.receipts as Receipt[]
      const _latestReceipt = last(sortBy(_receipts, 'createdAt')) as Receipt | undefined
      const _invoice = billing.invoice as Invoice | undefined

      doc.fontSize(8)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Receipt No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(_latestReceipt.receiptNumber, 499, doc.y - 10, { align: 'left' })

      // ---
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Invoice No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(_invoice.invoiceNumber, 499, doc.y - 10, { align: 'left' })

      // ---
      const receiptInBEDateMonth = fDate(_latestReceipt.receiptDate, 'dd/MM')
      const receiptInBEYear = toNumber(fDate(_latestReceipt.receiptDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 499, doc.y - 10, { align: 'left' })
      // Doc Number React
    } else if (type === 'creditnote' || type === 'debitnote') {
      // ---
      const _adjistmentNotes = billing.adjustmentNotes as BillingAdjustmentNote[]
      const _adjistmentNote = (
        targetId
          ? find(_adjistmentNotes, (item) => item._id.toString() === targetId.toString())
          : last(sortBy(_adjistmentNotes, 'issueDate'))
      ) as BillingAdjustmentNote | undefined

      doc.fontSize(8)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text(type === 'creditnote' ? 'Credit note No.:' : 'Debit note No.:', docNumberReactX, doc.y, {
          align: 'right',
          width: docNumberRectWidth / 2 - 4,
        }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(_adjistmentNote?.adjustmentNumber, 499, doc.y - 10, { align: 'left' })

      // ---
      const receiptInBEDateMonth = fDate(_adjistmentNote?.issueDate, 'dd/MM')
      const receiptInBEYear = toNumber(fDate(_adjistmentNote?.issueDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 499, doc.y - 10, { align: 'left' })

      // ---
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Ref invoice No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(_adjistmentNote?.previousDocumentRef.documentNumber, 499, doc.y - 10, { align: 'left' })
      // Doc Number React
    }
    doc.rect(docNumberReactX, 54, docNumberRectWidth, 84).lineWidth(2).stroke()
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(marginLeft, doc.y + 14)
      .lineTo(maxWidth, doc.y + 14)
      .stroke()
    doc.moveDown(2.2)
  }

  // Seperate line

  const user = billing.user as User | undefined
  const isBusiness = user.userType === EUserType.BUSINESS
  const address = user.address
  const taxId = isBusiness ? get(user, 'businessDetail.taxNumber', '-') : get(user, 'individualDetail.taxId', '-')

  // Customer detail
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(7)
  doc.text('ชื่อลูกค้า :', 22)
  doc.text(user.fullname, 110, doc.y - 9)
  doc.font(FONTS.SARABUN_LIGHT)
  if (isBusiness) {
    const businessBranch = get(user, 'businessDetail.businessBranch', '-')
    doc.text('สาขา :', 280, doc.y - 9)
    doc.text(businessBranch || '-', 308, doc.y - 9)
  }
  doc.moveDown(0.6)
  doc.font(FONTS.SARABUN_MEDIUM).text(isCreditPayment ? 'เลขประจำตัวผู้เสียภาษี' : 'อีเมล :', 22)
  doc.font(FONTS.SARABUN_LIGHT).text(isCreditPayment ? taxId : user.email || '-', 110, doc.y - 9)
  doc.moveDown(0.6)
  doc.font(FONTS.SARABUN_MEDIUM).text('ที่อยู่ :', 22)
  doc.font(FONTS.SARABUN_LIGHT).text(address || '-', 110, doc.y - 9)

  // Page detail
  doc.moveDown(1.6)
  doc.fontSize(8)
  doc.font(FONTS.SARABUN_MEDIUM).text('Page :', 0, doc.y, { width: 500, align: 'right' })
  doc.font(FONTS.SARABUN_LIGHT).text(`${page} of ${totalPage}`, 500, doc.y - 10, { align: 'center', width: 76 })
  doc.moveDown(0.5)
  doc.font(FONTS.SARABUN_MEDIUM).text('รายละเอียด', 22)
  doc.font(FONTS.SARABUN_MEDIUM).text('สกุลเงิน :', 0, doc.y - 10, { width: 500, align: 'right' })
  doc.font(FONTS.SARABUN_LIGHT).text('บาท (THB)', 500, doc.y - 10, { align: 'center', width: 76 })

  doc.moveDown(0.5)

  // Seperate line
  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(marginLeft, doc.y + 4)
    .lineTo(maxWidth, doc.y + 4)
    .stroke()

  doc.moveDown(1)
  doc.x = 0

  return doc
}
