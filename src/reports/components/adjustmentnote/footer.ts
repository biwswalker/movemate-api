import PDFDocument from 'pdfkit-table'
import { BillingAdjustmentNote } from '@models/finance/billingAdjustmentNote.model'
import ThaiBahtText from 'thai-baht-text'
import { ASSETS, COLORS, FONTS } from '../constants'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { toNumber } from 'lodash'
import { EAdjustmentNoteType } from '@enums/billing'

export async function AdjustmentNoteFooterComponent(doc: PDFDocument, adjustmentNote: BillingAdjustmentNote) {
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight

  // เส้นคั่น
  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(marginLeft, doc.y - 6)
    .lineTo(maxWidth, doc.y - 6)
    .stroke()
  doc.moveDown(2).fillColor(COLORS.TEXT_PRIMARY)

  const isDebit = adjustmentNote.adjustmentType === EAdjustmentNoteType.DEBIT_NOTE

  // --- ส่วนสรุปยอดทางการเงิน ---
  const _tempY = doc.y - 10
  doc
    .fontSize(8)
    .font(FONTS.SARABUN_BOLD)
    .text(`เหตุผลในการ${isDebit ? 'เพิ่ม' : 'ลด'}หนี้: `, marginLeft, _tempY)
    .moveDown(1.5)
  doc.font(FONTS.SARABUN_LIGHT).text(adjustmentNote.remarks, marginLeft, doc.y - 10.5, { width: 250 })

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('มูลค่าตามใบแจ้งหนี้เดิม :', 0, _tempY, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(8)
    .text(fCurrency(adjustmentNote.originalSubTotal), 400, _tempY, { align: 'right', width: maxWidth - 400 })
    .moveDown(1.5)

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('มูลค่าที่ถูกต้อง :', 0, doc.y - 10, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(8)
    .text(fCurrency(adjustmentNote.newSubTotal), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })
    .moveDown(1.5)

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('ผลต่าง :', 0, doc.y - 10, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(8)
    .text(fCurrency(adjustmentNote.adjustmentSubTotal), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })
    .moveDown(1.5)

  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(8)
    .text(fCurrency(adjustmentNote.taxAmount), 400, doc.y - 10, { align: 'right', width: maxWidth - 400 })

  doc.moveDown(2.5)
  doc
    .fontSize(8)
    .font(FONTS.SARABUN_MEDIUM)
    .text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_SEMI_BOLD)
    .fontSize(10)
    .text(fCurrency(adjustmentNote.totalAmount), 400, doc.y - 12, { align: 'right', width: maxWidth - 400 })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(432, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc
    .fontSize(7)
    .font(FONTS.SARABUN_LIGHT)
    .text(`( ${ThaiBahtText(adjustmentNote.totalAmount)} )`, 0, doc.y + 8, {
      align: 'right',
      width: maxWidth,
    })

  // Bank info
  doc.moveDown(4)

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

  // --- ส่วนท้ายและลายเซ็น (เหมือนเดิม) ---
  const issueBEDate = fDate(adjustmentNote.issueDate, 'dd')
  const issueBEMonth = fDate(adjustmentNote.issueDate, 'MM')
  const issueBEYear = toNumber(fDate(adjustmentNote.issueDate, 'yyyy')) + 543

  const signatureX = maxWidth / 2
  const signatureWidth = maxWidth - signatureX
  doc
    .fontSize(7)
    .fillColor(COLORS.TEXT_SECONDARY)
    .text('_____________________________________________', signatureX, doc.y, {
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
    .text('(ผู้มีอำนาจลงนาม)', signatureX, doc.y - 9, { width: signatureWidth, align: 'center' })

  doc.image(ASSETS.SIGNATURE, signatureX + 108, doc.y - 85, { width: 78 })
  doc.image(ASSETS.THEPPAWNCHAI, signatureX + 100 + 78, doc.y - 125, { width: 100 })
}
