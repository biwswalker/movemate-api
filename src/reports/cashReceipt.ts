import fs from 'fs'
import path from 'path'
import { get, reduce, head, tail, clone, round } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { CashReceiptHeaderComponent } from './components/cashReceipt/header'
import { CashReceiptFooterComponent } from './components/cashReceipt/footer'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import { Receipt } from '@models/finance/receipt.model'
import { Quotation } from '@models/finance/quotation.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import { User } from '@models/user.model'

interface GenerateReceiptResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateCashReceipt(
  billing: Billing,
  receipt: Receipt,
  session?: ClientSession,
): Promise<GenerateReceiptResponse> {
  // const _quotation = billing.quotation as Quotation
  // if (!_quotation) {
    //   const message = 'ไม่พบข้อมูลใบเสนอราคา'
    //   throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    // }
  const _user = billing.user as User
  if (!_user) {
    const message = 'ไม่พบข้อมูลลูกค้า'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (!receipt) {
    const message = 'ไม่พบข้อมูลใบเสร็จ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  const _document = receipt.document as BillingDocument | undefined

  const fileName = `${receipt.receiptNumber}.pdf`
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
    const vehicle = get(shipment, 'vehicleId', undefined) as VehicleType | undefined
    const no = index + 1
    const options: DataOptions = {
      fontFamily: FONTS.SARABUN_LIGHT,
      fontSize: 8,
      separation: false,
    }

    const dropoffs = tail(shipment.destinations)
    const details = `ค่าขนส่ง${vehicle.name} ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
      '',
    )}`
    // const amount = latestQuotation?.price?.total || 0
    const amount = receipt.subTotal || 0

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
  CashReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)

  await doc.on('pageAdded', () => {
    currentPage++
    if (!nomoredata) {
      CashReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)
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
  CashReceiptFooterComponent(doc, receipt)
  isOiginal = false

  // // Copy section
  await doc.addPage()
  nomoredata = false
  currentPage = 1
  CashReceiptHeaderComponent(doc, _user, receipt, currentPage, currentPage, isOiginal)

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
  CashReceiptFooterComponent(doc, receipt)

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
