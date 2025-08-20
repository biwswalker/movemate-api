import PDFDocument from 'pdfkit-table'
import { ASSETS, COLORS, FONTS } from '../constants'
import { fCurrency } from '@utils/formatNumber'
import ThaiBahtText from 'thai-baht-text'
import { fDate } from '@utils/formatTime'
import { toNumber } from 'lodash'
import { Receipt } from '@models/finance/receipt.model'
import { BillingDocument } from '@models/finance/documents.model'

const CONSTANTS = {
  TOTAL: 'รวมที่ต้องชำระทั้งสิ้น :',
  SUBTOTAL: 'รวมเป็นเงิน :',
  TAX: 'ภาษีหัก ณ ที่จ่าย 1% :',
  REMARK: 'หมายเหตุ',
  CUSTOMER_LABEL: '(ผู้ให้บริการ)',
}

export function CashReceiptFooterComponent(doc: PDFDocument, receipt: Receipt) {
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

  if (receipt.tax > 0) {
    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text(CONSTANTS.SUBTOTAL, 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(receipt.subTotal, true), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })
      .moveDown(1.5)

    doc
      .fontSize(8)
      .font(FONTS.SARABUN_MEDIUM)
      .text(CONSTANTS.TAX, 0, doc.y - 10, { width: 400, align: 'right' })
    doc
      .font(FONTS.SARABUN_LIGHT)
      .fontSize(8)
      .text(fCurrency(receipt.tax, true), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })

    doc.moveDown(2.6)
  }

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text(CONSTANTS.TOTAL, 0, doc.y - 12, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_SEMI_BOLD)
    .fontSize(10)
    .text(fCurrency(receipt.total, true), 400, doc.y - 12, { align: 'right', width: maxWidth - 400 })
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
  const receivedWHTDocumentDate = (receipt.document as BillingDocument)?.receivedWHTDocumentDate
  if (receipt.tax > 0 && !receivedWHTDocumentDate) {
    if (receipt.remarks) {
      doc.font(FONTS.SARABUN_MEDIUM).fontSize(9).text(CONSTANTS.REMARK, marginLeft).moveDown(0.8)
      doc.font(FONTS.SARABUN_LIGHT).fontSize(7).text(receipt.remarks, marginLeft).moveDown(2)
      // doc.moveDown(16)
    } else {
      doc.moveDown(4)
    }
    // Tax detail
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
    if (receipt.remarks) {
      doc.font(FONTS.SARABUN_MEDIUM).fontSize(9).text(CONSTANTS.REMARK, marginLeft).moveDown(0.8)
      doc.font(FONTS.SARABUN_LIGHT).fontSize(7).text(receipt.remarks, marginLeft)
      doc.moveDown(2)
    } else {
      doc.moveDown(4)
    }
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
    .text(CONSTANTS.CUSTOMER_LABEL, signatureX, doc.y - 9, { width: signatureWidth, align: 'center' })
  doc.image(ASSETS.SIGNATURE, signatureX + 108, doc.y - 90, { width: 78 })
  doc.image(ASSETS.THEPPAWNCHAI, signatureX + 100 + 40, doc.y - (94 + 46), { width: 100 })
}
