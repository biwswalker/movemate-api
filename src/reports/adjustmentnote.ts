import { findIndex, round } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { HeaderComponent } from './components/header'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { BillingAdjustmentNote } from '@models/finance/billingAdjustmentNote.model'
import { EAdjustmentNoteType } from '@enums/billing'
import { AdjustmentNoteFooterComponent } from './components/adjustmentnote/footer'

interface GenerateAdjustmentNoteResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateAdjustmentNote(
  billing: Billing,
  adjustmentNote: BillingAdjustmentNote,
  session?: ClientSession,
): Promise<GenerateAdjustmentNoteResponse> {
  billing
  const documentType =
    adjustmentNote.adjustmentType === EAdjustmentNoteType.DEBIT_NOTE
      ? { title: 'ใบเพิ่มหนี้', short: 'DR', full: 'debitnote' }
      : { title: 'ใบลดหนี้', short: 'CR', full: 'creditnote' }

  const number = findIndex(billing.adjustmentNotes, { _id: adjustmentNote._id })
  const fileName = `${documentType.full}_${number + 1}_${adjustmentNote.adjustmentNumber}.pdf`

  const filePath = path.join(__dirname, '..', '..', 'generated/adjustmentnote', fileName) // หรือ path ที่ต้องการ

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 56, left: 22, right: 22 },
    autoFirstPage: false,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    },
  })

  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)
  doc.addPage()

  doc.font(FONTS.SARABUN_LIGHT).fontSize(8)

  // --- สร้างข้อมูลสำหรับตาราง ---
  const tableData = adjustmentNote.items.map((item, index) => {
    const options: DataOptions = {
      fontFamily: FONTS.SARABUN_LIGHT,
      fontSize: 8,
      separation: false,
    }
    return {
      no: { label: String(index + 1), options },
      serviceDate: { label: item.serviceDate ? fDate(item.serviceDate, 'dd/MM/yyyy') : '-', options },
      shipmentNumber: { label: item.shipmentNumber || '-', options },
      details: { label: item.description, options: { ...options, align: 'left' } },
      amount: { label: fCurrency(item.amount), options },
      totalAmount: { label: fCurrency(item.amount), options },
    }
  })

  const headerOption = { align: 'center', valign: 'top', headerColor: COLORS.COMMON_WHITE }
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.margins.right
  const maxWidth = doc.page.width - marginRight - marginLeft
  const getColumnPercent = (percent: number) => round(maxWidth * (percent / 100))

  const tableHeaders = [
    { label: 'ลำดับ', property: 'no', width: getColumnPercent(6), ...headerOption },
    { label: 'วันที่บริการ', property: 'serviceDate', width: getColumnPercent(10), ...headerOption },
    { label: 'หมายเลขงาน', property: 'shipmentNumber', width: getColumnPercent(14), ...headerOption },
    { label: 'รายละเอียด', property: 'details', width: getColumnPercent(40), ...headerOption },
    { label: 'จำนวนเงิน', property: 'amount', width: getColumnPercent(15), ...headerOption, align: 'right' },
    { label: 'จำนวนเงินสุทธิ', property: 'totalAmount', width: getColumnPercent(15), ...headerOption, align: 'right' },
  ]

  const table: Table = { headers: tableHeaders, datas: tableData as any }

  // --- สร้างเอกสาร (ต้นฉบับและสำเนา) ---
  const generatePage = async (isOriginal: boolean) => {
    // ใช้ HeaderComponent เดิม แต่ส่ง title ของเอกสารใหม่เข้าไป
    // คุณอาจจะต้องปรับ HeaderComponent เล็กน้อยเพื่อให้รับ title ได้แบบ dynamic
    HeaderComponent(doc, billing, documentType.full as any, 1, 1, isOriginal, adjustmentNote._id)

    await doc.table(table, {
      minRowTHHeight: 16,
      divider: {
        header: { disabled: false, width: 1, opacity: 1 },
        horizontal: { disabled: true },
      },
      prepareHeader: () => doc.font(FONTS.SARABUN_MEDIUM).fontSize(7),
    })

    await AdjustmentNoteFooterComponent(doc, adjustmentNote)
  }

  await generatePage(true) // สร้างต้นฉบับ
  await doc.addPage()
  await generatePage(false) // สร้างสำเนา

  doc.end()
  await new Promise((resolve) => writeStream.on('finish', resolve))

  const _document = adjustmentNote.document as BillingDocument | undefined
  if (_document) {
    const _updatedDocument = await BillingDocumentModel.findByIdAndUpdate(
      _document._id,
      { filename: fileName },
      { session, new: true },
    )
    return { fileName, filePath, document: _updatedDocument }
  } else {
    const _document = new BillingDocumentModel({ filename: fileName })
    await _document.save({ session })
    return { fileName, filePath, document: _document }
  }
}
