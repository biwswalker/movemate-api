import PDFDocument from 'pdfkit-table'
import { ASSETS, COLORS, FONTS } from '../constants'
import { fCurrency } from '@utils/formatNumber'
import ThaiBahtText from 'thai-baht-text'
import { fDate } from '@utils/formatTime'
import { toNumber } from 'lodash'
import { Receipt } from '@models/finance/receipt.model'

const CONSTANTS = {
  TOTAL: 'รวมที่ต้องชำระทั้งสิ้น :',
  REMARK: 'หมายเหตุ',
  CUSTOMER_LABEL: '(ผู้ใช้บริการ)',
}

export function AdvanceReceiptFooterComponent(doc: PDFDocument, receipt: Receipt) {
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

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text(CONSTANTS.TOTAL, 0, doc.y - 12, { width: 400, align: 'right' })
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
  doc.font(FONTS.SARABUN_MEDIUM).fontSize(9).text(CONSTANTS.REMARK, marginLeft).moveDown(0.8)
  doc.moveDown(4)

  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(7)
    .text('เอกสารนี้เป็นหลักฐานการรับเงินล่วงหน้า เพื่อใช้สำหรับการให้บริการในอนาคต', marginLeft)
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(7)
    .text('เอกสารนี้ไม่ใช่ใบเสร็จรับเงิน หรือใบกำกับภาษี', marginLeft)
    .moveDown(1)
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(7)
    .text('ใบเสร็จรับเงินจะออกเมื่อให้บริการเสร็จสมบูรณ์', marginLeft)
    .moveDown(8)

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
  doc.image(ASSETS.THEPPAWNCHAI, signatureX + 100 + 78, doc.y - (94 + 64), { width: 100 })
}
