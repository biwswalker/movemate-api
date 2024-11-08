import { BillingCycle } from '@models/billingCycle.model'
import PDFDocument from 'pdfkit-table'
import { ASSETS, COLORS, FONTS } from './constants'
import { fCurrency } from '@utils/formatNumber'
import ThaiBahtText from 'thai-baht-text'
import { fDate } from '@utils/formatTime'
import { toNumber } from 'lodash'

export async function CashNoTaxReceiptFooterComponent(doc: PDFDocument, billingCycle: BillingCycle) {
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
    .text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 400, align: 'right' })
  doc
    .font(FONTS.SARABUN_SEMI_BOLD)
    .fontSize(10)
    .text(fCurrency(billingCycle.totalAmount), 400, doc.y - 12, { align: 'right', width: maxWidth - 400 })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(432, doc.y + 3)
    .lineTo(maxWidth, doc.y + 3)
    .stroke()
  doc
    .fontSize(7)
    .font(FONTS.SARABUN_LIGHT)
    .text(`( ${ThaiBahtText(billingCycle.totalAmount)} )`, 0, doc.y + 8, {
      align: 'right',
      width: maxWidth,
    })

  // After transfer detail
  doc.moveDown(18)
  doc
    .font(FONTS.SARABUN_LIGHT)
    .fontSize(6)
    .text('หากต้องการแก้ไขใบเสร็จรับเงิน กรุณาติดต่อ acc@movematethailand.com ภายใน 3 วันทำการ', marginLeft)
    .moveDown(1)
    .text(
      'หลังจากได้รับเอกสาร มิเช่นนั้นทางบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบรณ์ เป็นที่เรียบร้อยแล้ว',
      marginLeft,
    )

  const issueBEDate = fDate(billingCycle.issueDate, 'dd')
  const issueBEMonth = fDate(billingCycle.issueDate, 'MM')
  const issueBEYear = toNumber(fDate(billingCycle.issueDate, 'yyyy')) + 543

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
