import PDFDocument from 'pdfkit-table'
import { ASSETS, FONTS } from '../constants'
import { fDate } from '@utils/formatTime'
import { toNumber } from 'lodash'
import { User } from '@models/user.model'
import { Receipt } from '@models/finance/receipt.model'

const CONSTANTS = {
  // Movemate Company Info
  MM_COMPANY_NAME: 'บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จํากัด',
  MM_COMPANY_BRANCH: 'สาขา : (สำนักงานใหญ่)',
  MM_ADDRESS: 'เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310',
  MM_TAX_ID: 'เลขประจําตัวผู้เสียภาษี: 0105564086723',
  MM_CONTACT_NUMBER: 'ติดต่อ: 02-xxx-xxxx',
  MM_CONTACT_EMAIL: 'อีเมล์: acc@movematethailand.com',
  // Document Info
  DOCUMENT_NAME: 'RECEIPT',
  DOCUMENT_TH_NAME: 'ใบเสร็จรับเงิน',
  ORIGIN: '(ต้นฉบับ)',
  COPY: '(สำเนา)',
  RECEIPT_NO: 'Receipt No.:',
  ADVANCE_RECEIPT_DATE: 'Refer Advance Receipt No.:',
  RECEIPT_DATE: 'Date :',
  // Customer Info
  CUSTOMER_NAME: 'ชื่อลูกค้า :',
  CUSTOMER_EMAIL: 'อีเมล :',
  CUSTOMER_ADDRESS: 'ที่อยู่ :',
  //
  TABLE_TITLE: 'รายละเอียด',
  TABLE_PAGE: 'Page :',
  CURRENCY: 'สกุลเงิน :',
  THB: 'บาท (THB)',
}

export function NonTaxReceiptHeaderComponent(
  doc: PDFDocument,
  user: User,
  receipt: Receipt,
  page: number,
  totalPage: number,
  isOriginal: boolean = true,
) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight
  // Logo
  doc.image(ASSETS.LOGO, doc.page.margins.left, 60, { width: 80 })

  // Company Movemate info
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(8).text(CONSTANTS.MM_COMPANY_NAME, 110, 60)
  doc.font(FONTS.SARABUN_LIGHT).fontSize(7)
  doc.text(CONSTANTS.MM_COMPANY_BRANCH, 280, 61)
  doc.moveDown(0.8)
  doc.text(CONSTANTS.MM_ADDRESS, 110)
  doc.moveDown(0.6)
  doc.text(CONSTANTS.MM_TAX_ID, 110)
  doc.moveDown(0.6)
  doc.text(CONSTANTS.MM_CONTACT_NUMBER, 110)
  doc.moveDown(0.6)
  doc.text(CONSTANTS.MM_CONTACT_EMAIL, 110)

  // Receipt number detail
  const docNumberReactX = 420
  const docNumberRectWidth = maxWidth - docNumberReactX

  doc.font(FONTS.SARABUN_REGULAR).fontSize(13).text(CONSTANTS.DOCUMENT_NAME, docNumberReactX, 55, {
    align: 'center',
    width: docNumberRectWidth,
  })
  doc.moveDown(0.3)
  doc.font(FONTS.SARABUN_LIGHT).fontSize(9)
  doc.text(`${CONSTANTS.DOCUMENT_TH_NAME} ${isOriginal ? CONSTANTS.ORIGIN : CONSTANTS.COPY}`, docNumberReactX, doc.y, {
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

  // Doc: Number, Date
  doc.fontSize(8)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .text(CONSTANTS.RECEIPT_NO, docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
  doc.font(FONTS.SARABUN_LIGHT).text(receipt.receiptNumber, 499, doc.y - 10, { align: 'left' })
  // ---
  doc.moveDown(0.3)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .text(CONSTANTS.ADVANCE_RECEIPT_DATE, docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
  doc.font(FONTS.SARABUN_LIGHT).text(receipt?.refReceiptNumber || '-', 499, doc.y - 10, { align: 'left' })
  // ---
  const receiptInBEDateMonth = fDate(receipt.receiptDate, 'dd/MM')
  const receiptInBEYear = toNumber(fDate(receipt.receiptDate, 'yyyy')) + 543
  doc.moveDown(0.3)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .text(CONSTANTS.RECEIPT_DATE, docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
  doc.font(FONTS.SARABUN_LIGHT).text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 499, doc.y - 10, { align: 'left' })
  // ---
  doc.rect(docNumberReactX, 54, docNumberRectWidth, 70).lineWidth(2).stroke()
  // doc.moveDown(0.5)
  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(marginLeft, doc.y + 14)
    .lineTo(maxWidth, doc.y + 14)
    .stroke()
  doc.moveDown(2.2)
  // Seperate line

  const address = user.address || '-'
  const email = user.email || '-'

  // Customer detail
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(7)
  doc.text(CONSTANTS.CUSTOMER_NAME, 22)
  doc.text(user.fullname, 110, doc.y - 9)
  doc.font(FONTS.SARABUN_LIGHT)
  doc.moveDown(0.6)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.CUSTOMER_EMAIL, 22)
  doc.font(FONTS.SARABUN_LIGHT).text(email, 110, doc.y - 9)
  doc.moveDown(0.6)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.CUSTOMER_ADDRESS, 22)
  doc.font(FONTS.SARABUN_LIGHT).text(address || '-', 110, doc.y - 9)
  // Page detail
  doc.moveDown(1.6)
  doc.fontSize(8)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.TABLE_PAGE, 0, doc.y, { width: 500, align: 'right' })
  doc.font(FONTS.SARABUN_LIGHT).text(`${page} of ${totalPage}`, 500, doc.y - 10, { align: 'center', width: 76 })
  doc.moveDown(0.5)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.TABLE_TITLE, 22)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.CURRENCY, 0, doc.y - 10, { width: 500, align: 'right' })
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.THB, 500, doc.y - 10, { align: 'center', width: 76 })
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
