import { get, reduce, head, tail, clone, round, last, sortBy, isEmpty } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { HeaderComponent } from './components/header'
import ReceiptFooterComponent from './components/footer'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import { Receipt } from '@models/finance/receipt.model'
import { Quotation } from '@models/finance/quotation.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'

interface GenerateReceiptResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateReceipt(
  billing: Billing,
  filname?: string,
  session?: ClientSession,
): Promise<GenerateReceiptResponse> {
  const isTaxIncluded = billing.amount.tax > 0
  const _receipts = billing.receipts as Receipt[]
  const _receipt = last(sortBy(_receipts, 'createdAt')) as Receipt | undefined
  if (!_receipt) {
    const message = 'ไม่พบข้อมูลใบเสร็จ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  const _document = _receipt.document as BillingDocument | undefined
  const isReceiveWHTDocument = !isEmpty(_document?.receviedWHTDocumentDate)

  const fileName = filname ? filname : `receipt_${_receipt.receiptNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/receipt', fileName)

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 56, left: 22, right: 22 },
    autoFirstPage: false,
  })

  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)
  doc.addPage()

  doc.font(FONTS.SARABUN_LIGHT).fontSize(8)

  const billingShipments = (billing.shipments || []) as Shipment[]

  const _shipments = billingShipments.map((shipment, index) => {
    const pickup = head(shipment.destinations)
    const dropoffs = tail(shipment.destinations)
    const venicle = get(shipment, 'vehicleId', undefined) as VehicleType | undefined
    const details = `ค่าขนส่ง${venicle.name} ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
      '',
    )}`
    const no = index + 1
    const latestQuotation = last(sortBy(shipment.quotations, 'createdAt')) as Quotation | undefined
    const options: DataOptions = {
      fontFamily: FONTS.SARABUN_LIGHT,
      fontSize: 8,
      separation: false,
    }
    return {
      no: { label: String(no), options },
      bookingDateTime: { label: fDate(shipment.bookingDateTime, 'dd/MM/yyyy'), options },
      trackingNumber: { label: shipment.trackingNumber, options },
      details: { label: details, options: { ...options, align: 'left' } },
      subtotal: { label: fCurrency(latestQuotation.price.total || 0), options },
      total: { label: fCurrency(latestQuotation.price.total || 0), options },
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
  HeaderComponent(doc, billing, 'receipt', currentPage, currentPage, isOiginal)

  await doc.on('pageAdded', () => {
    currentPage++
    if (!nomoredata) {
      HeaderComponent(doc, billing, 'receipt', currentPage, currentPage, isOiginal)
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
  await ReceiptFooterComponent(doc, billing, isTaxIncluded, isReceiveWHTDocument)
  isOiginal = false

  // Copy section
  await doc.addPage()
  nomoredata = false
  await HeaderComponent(doc, billing, 'receipt', currentPage, currentPage, isOiginal)

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
  await ReceiptFooterComponent(doc, billing, isTaxIncluded, isReceiveWHTDocument)

  doc.end()
  await new Promise((resolve) => writeStream.on('finish', resolve))

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
