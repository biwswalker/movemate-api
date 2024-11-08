import { BillingCycle } from '@models/billingCycle.model'
import { BillingReceipt } from '@models/billingReceipt.model'
import PDFDocument from 'pdfkit-table'
import { ASSETS, FONTS } from './constants'
import { fDate } from '@utils/formatTime'
import { get, toNumber } from 'lodash'
import { User } from '@models/user.model'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { BusinessCustomerCreditPayment } from '@models/customerBusinessCreditPayment.model'
import { IndividualCustomer } from '@models/customerIndividual.model'
import { EPaymentMethod } from '@enums/payments'
import { EUserType } from '@enums/users'

export function HeaderComponent(
  doc: PDFDocument,
  billingCycle: BillingCycle,
  type: 'invoice' | 'receipt',
  page: number,
  totalPage: number,
  isOriginal: boolean = true,
) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight
  const isCreditPayment = billingCycle.paymentMethod === EPaymentMethod.CREDIT
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
  doc
    .font(FONTS.SARABUN_REGULAR)
    .fontSize(13)
    .text(type === 'receipt' ? 'RECEIPT' : 'INVOICE', docNumberReactX, 55, {
      align: 'center',
      width: docNumberRectWidth,
    })
  doc.moveDown(0.3)
  doc.font(FONTS.SARABUN_LIGHT).fontSize(9)
  doc.text(
    `${type === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'} ${isOriginal ? '(ต้นฉบับ)' : '(สำเนา)'}`,
    docNumberReactX,
    doc.y,
    {
      align: 'center',
      width: docNumberRectWidth,
    },
  )
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(docNumberReactX, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc.moveDown(0.5)

  if (isCreditPayment) {
    if (type === 'invoice') {
      // 1
      doc.fontSize(8)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Invoice No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(billingCycle.billingNumber, 499, doc.y - 10, { align: 'left' })

      // 2
      const issueInBEDateMonth = fDate(billingCycle.issueDate, 'dd/MM')
      const issueInBEYear = toNumber(fDate(billingCycle.issueDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(`${issueInBEDateMonth}/${issueInBEYear}`, 499, doc.y - 10, { align: 'left' })

      // 3
      const duedateInBEDateMonth = fDate(billingCycle.paymentDueDate, 'dd/MM')
      const duedateInBEYear = toNumber(fDate(billingCycle.paymentDueDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Due Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(`${duedateInBEDateMonth}/${duedateInBEYear}`, 499, doc.y - 10, { align: 'left' })
    } else {
      // 1
      const billingReceipt = billingCycle.billingReceipt as BillingReceipt

      doc.fontSize(8)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Receipt No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(billingReceipt.receiptNumber, 499, doc.y - 10, { align: 'left' })

      // 2
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Issue No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc.font(FONTS.SARABUN_LIGHT).text(billingCycle.billingNumber, 499, doc.y - 10, { align: 'left' })

      // 3
      const receiptInBEDateMonth = fDate(billingReceipt.receiptDate, 'dd/MM')
      const receiptInBEYear = toNumber(fDate(billingReceipt.receiptDate, 'yyyy')) + 543
      doc.moveDown(0.3)
      doc
        .font(FONTS.SARABUN_MEDIUM)
        .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
      doc
        .font(FONTS.SARABUN_LIGHT)
        .text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 499, doc.y - 10, { align: 'left' })
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
  } else {
    const billingReceipt = billingCycle.billingReceipt as BillingReceipt
    // Receipt No
    doc.fontSize(8)
    doc
      .font(FONTS.SARABUN_MEDIUM)
      .text('Receipt No.:', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
    doc.font(FONTS.SARABUN_LIGHT).text(billingReceipt.receiptNumber, 499, doc.y - 10, { align: 'left' })

    const receiptInBEDateMonth = fDate(billingReceipt.receiptDate, 'dd/MM')
    const receiptInBEYear = toNumber(fDate(billingReceipt.receiptDate, 'yyyy')) + 543
    // Date
    doc.moveDown(0.3)
    doc
      .font(FONTS.SARABUN_MEDIUM)
      .text('Date :', docNumberReactX, doc.y, { align: 'right', width: docNumberRectWidth / 2 - 4 }) // 81
    doc.font(FONTS.SARABUN_LIGHT).text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 499, doc.y - 10, { align: 'left' })
    // Doc Number React

    doc.rect(docNumberReactX, 54, docNumberRectWidth, 72).lineWidth(2).stroke()
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(marginLeft, doc.y + 24)
      .lineTo(maxWidth, doc.y + 24)
      .stroke()
    doc.moveDown(3)
  }

  // Seperate line

  let address = '-'
  const user = get(billingCycle, 'user', undefined) as User | undefined
  const businessDetail = get(user, 'businessDetail', undefined) as BusinessCustomer | undefined
  const paymentMethod = get(businessDetail, 'paymentMethod', '')
  if (paymentMethod === EPaymentMethod.CASH) {
    address = `${businessDetail.address} แขวง/ตำบล ${businessDetail.subDistrict} เขต/อำเภอ ${businessDetail.district} จังหวัด ${businessDetail.province} ${businessDetail.postcode}`
  } else if (paymentMethod === EPaymentMethod.CREDIT && businessDetail.creditPayment) {
    const creditPayment = businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
    address = `${creditPayment.financialAddress} แขวง/ตำบล ${creditPayment.financialSubDistrict} เขต/อำเภอ ${creditPayment.financialDistrict} จังหวัด ${creditPayment.financialProvince} ${creditPayment.financialPostcode}`
  } else if (user.individualDetail) {
    const individualDetail = user.individualDetail as IndividualCustomer | undefined
    if (individualDetail.address) {
      address = `${individualDetail.address} แขวง/ตำบล ${individualDetail.subDistrict} เขต/อำเภอ ${individualDetail.district} จังหวัด ${individualDetail.province} ${individualDetail.postcode}`
    }
  }

  const isBusiness = user.userType === EUserType.BUSINESS
  const businessBranch = get(user, 'businessDetail.businessBranch', '-')
  const taxId = isBusiness ? get(user, 'businessDetail.taxNumber', '-') : get(user, 'individualDetail.taxId', '-')
  // Customer detail
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(7)
  doc.text('ชื่อลูกค้า :', 22)
  doc.text(user.fullname, 110, doc.y - 9)
  doc.font(FONTS.SARABUN_LIGHT)
  if (isBusiness) {
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
