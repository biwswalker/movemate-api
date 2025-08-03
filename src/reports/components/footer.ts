import PDFDocument from 'pdfkit-table'
import { ASSETS, COLORS, FONTS } from './constants'
import { fCurrency } from '@utils/formatNumber'
import ThaiBahtText from 'thai-baht-text'
import { fDate } from '@utils/formatTime'
import { sum, toNumber } from 'lodash'
import { Billing } from '@models/finance/billing.model'
import { Quotation } from '@models/finance/quotation.model'
import { Receipt } from '@models/finance/receipt.model'

export async function ReceiptFooterComponent(
  doc: PDFDocument,
  quotation: Quotation,
  receipt: Receipt,
  isReceiveWHTDocument?: boolean,
  isAdditionalPaid?: boolean,
) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight
  const remainingHeight = doc.page.height - doc.y - doc.page.margins.bottom

  const isTaxInclude = receipt.tax > 0

  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(marginLeft, doc.y - 6)
    .lineTo(maxWidth, doc.y - 6)
    .stroke()
    .fill(COLORS.TEXT_PRIMARY)

  doc
    .rect(
      doc.page.margins.left,
      doc.y,
      doc.page.width - doc.page.margins.left - doc.page.margins.right,
      remainingHeight,
    )
    .fill(COLORS.COMMON_WHITE)

  doc.moveDown(2.6).fillColor(COLORS.TEXT_PRIMARY)

  // Tax section
  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('รวมเป็นเงิน :', 0, doc.y - 10, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(8)
    .text(fCurrency(receipt.subTotal), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })
    .moveDown(1.5)
  
  if (isTaxInclude) {
    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(receipt.tax), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })

    doc.moveDown(2.6) //.fillColor(COLORS.TEXT_PRIMARY)
  }

  /**
   * กรณีเงินสด
   * Shipment เสร็จสิ้นแล้ว และชำระก่อนหน้านี้แล้ว
   * มีค่าใช้จ่ายเพิ่ม จะต้อง แสดงส่วนต่าง
   */
  if (isAdditionalPaid) {
    const _price = quotation.price
    const _paidBefore = sum([_price.total || 0, -_price.acturePrice || 0])

    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('ชำระก่อนหน้า :', 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(-_paidBefore), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })

    doc.moveDown(2.6)
  }

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_SEMI_BOLD)
    .fontSize(10)
    .text(fCurrency(receipt.total), 400, doc.y - 12, { align: 'right', width: maxWidth - 400 })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(432, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc
    .fontSize(7)
    .font(FONTS.SARABUN_LIGHT)
    .text(`( ${ThaiBahtText(receipt.total)} )`, 0, doc.y + 8, {
      align: 'right',
      width: maxWidth,
    })

  // After transfer detail
  if (isTaxInclude && !isReceiveWHTDocument) {
    // Tax detail
    doc.moveDown(4)
    doc.font(FONTS.SARABUN_MEDIUM).fontSize(9).text('กรุณาออกเอกสารภาษีหัก ณ ที่จ่าย ในนาม', marginLeft).moveDown(0.8)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text('บริษัท', marginLeft)
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด (สำนักงานใหญ่)', 94, doc.y - 11)
      .moveDown(0.5)
      .text('0105564086723', 94)
      .moveDown(0.8)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text('ที่อยู่', marginLeft)
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง', 94, doc.y - 11)
      .moveDown(0.5)
      .text('จังหวัดกรุงเทพมหานคร 10310', 94)

    doc.moveDown(4)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(7)
      .text('1. หากต้องการแก้ไขใบเสร็จรับเงิน กรุณาติดต่อ acc@movematethailand.com ภายใน 3 วันทำการ', marginLeft)
      .moveDown(1)
      .text(
        'หลังจากได้รับเอกสาร มิเช่นนั้นทางบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบูรณ์ เป็นที่เรียบร้อยแล้ว',
        marginLeft + 6,
      )
      .moveDown(1)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(7)
      .text(
        '2. เมื่อท่านได้ออกเอกสารภาษี หัก ณ ที่จ่ายแล้วให้ส่งเอกสารดังกล่าว มาที่ acc@movematethailand.com พร้อมอ้างอิงเลขที่ใบเสร็จรับเงิน',
        marginLeft,
      )
      .moveDown(1)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(7)
      .text('3. รบกวนส่งเอกสารภาษีหัก ณ ที่จ่ายฉบับจริงมาตามที่อยู่ในการออกเอกสารดังกล่าว', marginLeft)
      .moveDown(8)
  } else {
    // Non tax detail
    doc.moveDown(18)
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(7)
      .text('หากต้องการแก้ไขใบเสร็จรับเงิน กรุณาติดต่อ acc@movematethailand.com ภายใน 3 วันทำการ', marginLeft)
      .moveDown(1)
      .text(
        'หลังจากได้รับเอกสาร มิเช่นนั้นทางบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบูรณ์ เป็นที่เรียบร้อยแล้ว',
        marginLeft,
      )
  }

  /**
   * Signature
   */
  const issueBEDate = fDate(receipt.receiptDate, 'dd')
  const issueBEMonth = fDate(receipt.receiptDate, 'MM')
  const issueBEYear = toNumber(fDate(receipt.receiptDate, 'yyyy')) + 543

  const signatureX = maxWidth / 2
  const signatureWidth = maxWidth - signatureX
  doc
    .fontSize(7)
    .fillColor(COLORS.TEXT_SECONDARY)
    .text('_____________________________________________', signatureX, doc.y - 28, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(2)
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(...........................................................................)', signatureX, doc.y - 9, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(1.8)
    .text(
      `วันที่ ......${issueBEDate}...... / ......${issueBEMonth}...... / ....${issueBEYear}....`,
      signatureX,
      doc.y - 9,
      {
        width: signatureWidth,
        align: 'center',
      },
    )
  doc.moveDown(1.8)
  doc
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(ผู้ให้บริการ)', signatureX, doc.y - 9, { width: signatureWidth, align: 'center' })

  doc.image(ASSETS.SIGNATURE, signatureX + 108, doc.y - 90, { width: 78 })
  doc.image(ASSETS.THEPPAWNCHAI, signatureX + 100 + 78, doc.y - (94 + 64), { width: 100 })
}

export async function InvoiceFooterComponent(doc: PDFDocument, billing: Billing, taxIncluded?: boolean) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight
  const remainingHeight = doc.page.height - doc.y - doc.page.margins.bottom

  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(marginLeft, doc.y - 6)
    .lineTo(maxWidth, doc.y - 6)
    .stroke()
    .fill(COLORS.TEXT_PRIMARY)

  doc
    .rect(
      doc.page.margins.left,
      doc.y,
      doc.page.width - doc.page.margins.left - doc.page.margins.right,
      remainingHeight,
    )
    .fill(COLORS.COMMON_WHITE)

  doc.moveDown(2.6).fillColor(COLORS.TEXT_PRIMARY)

  // Tax section
  if (taxIncluded) {
    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('รวมเป็นเงิน :', 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(billing.amount.subTotal, true), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })
      .moveDown(1.5)
    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(billing.amount.tax, true), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })

    doc.moveDown(2) //.fillColor(COLORS.TEXT_PRIMARY)
  }

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_SEMI_BOLD)
    .fontSize(10)
    .text(fCurrency(billing.amount.total, true), 400, doc.y - 12, { align: 'right', width: maxWidth - 400 })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(432, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc
    .fontSize(7)
    .font(FONTS.SARABUN_LIGHT)
    .text(`( ${ThaiBahtText(billing.amount.total)} )`, 0, doc.y + 8, {
      align: 'right',
      width: maxWidth,
    })

  // TODO: Get config from setting database
  doc.moveDown(4)
  doc
    .fontSize(8)
    .font(FONTS.SARABUN_BOLD)
    .text('เงื่อนไขการชำระเงิน: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text(
      'ในกรณีที่ชำระเงินไม่ตรงตามระยะเวลาที่กำหนด บริษัทฯจะคิดค่าธรรมเนียมอัตราร้อยละ 3.0 ต่อเดือนของยอดค้างชำระจนถึงวันที่ชำระเงินครบถ้วน',
      92,
      doc.y - 10.5,
    )
    .moveDown(0.5)
    .text('ทั้งนี้ Movemate มีสิทธิ์ที่จะยกเลิกส่วนลดที่เกิดขึ้นก่อนทั้งหมด', marginLeft)
    .moveDown(2)

  doc.image(ASSETS.BANK.KBANK, 200, doc.y, { width: 100 })

  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(8)
    .text('ช่องทางชำระ: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text('ธนาคาร กสิกรไทย', 80, doc.y - 11)
    .moveDown(0.5)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(8)
    .text('ชื่อบัญชี: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด', 80, doc.y - 11)
    .moveDown(0.5)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(8)
    .text('เลขที่บัญชี: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text('117-1-54180-4', 80, doc.y - 11)
    .moveDown(0.5)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(8)
    .text('ประเภทบัญชี: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text('ออมทรัพย์', 80, doc.y - 11)
    .moveDown(0.5)
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(8)
    .text('สาขา: ', marginLeft)
    .font(FONTS.SARABUN_MEDIUM)
    .text('เซ็นทรัล บางนา', 80, doc.y - 11)
    .moveDown(0.5)

  doc.moveDown(1)
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(7)
    .text(
      'เมื่อท่านได้ชำระแล้วกรุณาส่งหลักฐานการชำระ มาที่ acc@movematethailand.com พร้อมอ้างอิงเลขที่ใบแจ้งหนี้',
      marginLeft,
    )
    .moveDown(0.5)
    .text(
      '*หากต้องการแก้ไขใบแจ้งหนี้และใบเสร็จรับเงิน กรุณาติตต่อ acc@movematethailand.com  ภายใน 3 วันทำการ',
      marginLeft,
    )
    .moveDown(0.5)
    .text(
      'หลังจากได้รับเอกสาร มิเช่นนั้นทางบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบูรณ์ เป็นที่เรียบร้อยแล้ว',
      marginLeft,
    )
    .moveDown(0.5)

  /**
   * Signature: Customer
   */
  const signatureX = maxWidth / 2
  const signatureWidth = maxWidth - signatureX

  doc
    .fontSize(7)
    .fillColor(COLORS.TEXT_SECONDARY)
    .text('_____________________________________________', marginLeft, doc.y + 64, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(2)
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(...........................................................................)', marginLeft, doc.y - 9, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(1.8)
    .text(
      `วันที่ ............... / ............... / ..............`,
      marginLeft,
      doc.y - 9,
      {
        width: signatureWidth,
        align: 'center',
      },
    )
  doc.moveDown(1.8)
  doc
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(ผู้ใช้บริการ)', marginLeft, doc.y - 9, { width: signatureWidth, align: 'center' })

  /**
   * Signature: Provider
   */
  const issueBEDate = fDate(billing.issueDate, 'dd')
  const issueBEMonth = fDate(billing.issueDate, 'MM')
  const issueBEYear = toNumber(fDate(billing.issueDate, 'yyyy')) + 543

  doc
    .fontSize(7)
    .fillColor(COLORS.TEXT_SECONDARY)
    .text('_____________________________________________', signatureX, doc.y - 61, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(2)
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(...........................................................................)', signatureX, doc.y - 9, {
      width: signatureWidth,
      align: 'center',
    })
  doc
    .moveDown(1.8)
    .text(
      `วันที่ ......${issueBEDate}...... / ......${issueBEMonth}...... / ....${issueBEYear}....`,
      signatureX,
      doc.y - 9,
      {
        width: signatureWidth,
        align: 'center',
      },
    )
  doc.moveDown(1.8)
  doc
    .fillColor(COLORS.TEXT_PRIMARY)
    .text('(ผู้ให้บริการ)', signatureX, doc.y - 9, { width: signatureWidth, align: 'center' })

  doc.image(ASSETS.SIGNATURE, signatureX + 108, doc.y - 90, { width: 78 })
  doc.image(ASSETS.THEPPAWNCHAI, signatureX + 100 + 78, doc.y - (94 + 64), { width: 100 })
}
