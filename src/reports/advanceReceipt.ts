import fs from 'fs'
import path from 'path'
import { get, reduce, head, tail, clone, round } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { AdvanceReceiptHeaderComponent } from './components/advanceReceipt/header'
import { AdvanceReceiptFooterComponent } from './components/advanceReceipt/footer'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import { Receipt } from '@models/finance/receipt.model'
import { Quotation } from '@models/finance/quotation.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import { User } from '@models/user.model'
import { PDFDocument as PdfLibDocument } from 'pdf-lib'

interface GenerateReceiptResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateAdvanceReceipt(
  billing: Billing,
  receipt: Receipt,
  session?: ClientSession,
): Promise<GenerateReceiptResponse> {
  const _quotation = billing.quotation as Quotation
  const _user = billing.user as User
  if (!_quotation) {
    const message = 'ไม่พบข้อมูลใบเสนอราคา'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (!_user) {
    const message = 'ไม่พบข้อมูลลูกค้า'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (!receipt) {
    const message = 'ไม่พบข้อมูลใบเสร็จ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  const _document = receipt.document as BillingDocument | undefined

  const generatedFile = new Promise<ArrayBuffer>(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 56, left: 22, right: 22 },
      autoFirstPage: false,
      permissions: {
        modifying: false,
      },
    })

    const buffers: Buffer[] = []
    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => resolve(Buffer.concat(buffers as any) as any))
    doc.on('error', reject)

    // const writeStream = fs.createWriteStream(filePath)
    // doc.pipe(writeStream)
    doc.addPage()

    doc.font(FONTS.SARABUN_LIGHT).fontSize(8)

    const billingShipments = (billing.shipments || []) as Shipment[]

    const _shipments = billingShipments.map((shipment, index) => {
      const pickup = head(shipment.destinations)
      const vehicle = get(shipment, 'vehicleId', undefined) as VehicleType | undefined
      const no = index + 1
      const options: DataOptions = {
        fontFamily: FONTS.SARABUN_LIGHT,
        fontSize: 8,
        separation: false,
      }

      let details = ''
      let amount = 0
      // กรณีงานสำเร็จ: แสดงเป็นค่าขนส่งปกติ
      const dropoffs = tail(shipment.destinations)
      details = `ค่าขนส่ง${vehicle.name} ${pickup.name} ไปยัง ${reduce(
        dropoffs,
        (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
        '',
      )}`
      amount = receipt.subTotal

      return {
        no: { label: String(no), options },
        bookingDateTime: { label: fDate(shipment.bookingDateTime, 'dd/MM/yyyy'), options },
        trackingNumber: { label: shipment.trackingNumber, options },
        details: { label: details, options: { ...options, align: 'left' } },
        subtotal: { label: fCurrency(amount, true), options },
        total: { label: fCurrency(amount, true), options },
      }
    })

    const headerOption = {
      align: 'center',
      valign: 'top',
      headerColor: COLORS.COMMON_WHITE,
    }

    const marginLeft = doc.page.margins.left
    const marginRight = doc.page.margins.right
    const maxWidth = doc.page.width - marginRight - marginLeft
    const getColumnPercent = (percent: number) => {
      return round(maxWidth * (percent / 100))
    }

    const _headers = [
      { label: 'ลำดับ', property: 'no', width: getColumnPercent(6), ...headerOption },
      { label: 'วันที่ใช้บริการ', property: 'bookingDateTime', width: getColumnPercent(10), ...headerOption },
      { label: 'หมายเลขงาน', property: 'trackingNumber', width: getColumnPercent(12), ...headerOption },
      { label: 'รายละเอียด', property: 'details', width: getColumnPercent(42), ...headerOption },
      { label: 'จำนวนเงิน', property: 'subtotal', width: getColumnPercent(15), ...headerOption, align: 'right' },
      { label: 'จำนวนเงินสุทธิ', property: 'total', width: getColumnPercent(15), ...headerOption, align: 'right' },
    ]

    const table: Table = { headers: _headers, datas: _shipments as any }

    let nomoredata = false
    let isOiginal = true
    let currentPage = 1
    const headerHeight = clone(doc.y - doc.page.margins.top)
    AdvanceReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)

    await doc.on('pageAdded', () => {
      currentPage++
      if (!nomoredata) {
        AdvanceReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)
        doc.moveDown(2)
      } else {
        doc.moveDown(10)
      }
    })

    await doc.table(table, {
      minHeaderHeight: headerHeight,
      minRowTHHeight: 16,
      divider: {
        header: { disabled: false, width: 1, opacity: 1 },
        horizontal: { disabled: true },
      },
      prepareHeader: () => doc.font(FONTS.SARABUN_MEDIUM).fontSize(7),
    })

    nomoredata = true
    AdvanceReceiptFooterComponent(doc, receipt)
    // isOiginal = false

    // // Copy section
    // await doc.addPage()
    // nomoredata = false
    // AdvanceReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)

    // await doc.table(table, {
    //   minHeaderHeight: headerHeight,
    //   minRowTHHeight: 16,
    //   divider: {
    //     header: { disabled: false, width: 1, opacity: 1 },
    //     horizontal: { disabled: true },
    //   },
    //   prepareHeader: () => doc.font(FONTS.SARABUN_MEDIUM).fontSize(7),
    // })
    // nomoredata = true
    // AdvanceReceiptFooterComponent(doc, receipt)

    doc.end()
    // await new Promise((resolve) => writeStream.on('finish', resolve))
  })

  const originalPDFBuffer = await generatedFile

  const pdfDoc = await PdfLibDocument.load(originalPDFBuffer)
  const form = pdfDoc.getForm()
  form.flatten()
  const finalPdfBytes = await pdfDoc.save()
  const finalPdfBuffer = Buffer.from(finalPdfBytes)
  const fileName = `${receipt.receiptNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/receipt', fileName)

  try {
    // ใช้ fs.writeFile เพื่อเขียน Buffer ทั้งหมดลงไฟล์ในครั้งเดียว
    await new Promise((resolve, reject) =>
      fs.writeFile(filePath, finalPdfBuffer as NodeJS.ArrayBufferView, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          reject(err)
        }
        resolve(true)
      }),
    )
  } catch (error) {
    console.error('Error writing PDF file:', error)
    throw new GraphQLError('ไม่สามารถบันทึกไฟล์ PDF ได้')
  }

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
