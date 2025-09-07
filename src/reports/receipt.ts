import { get, reduce, head, tail, clone, round, last, sortBy, isEmpty, toNumber } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { HeaderComponent } from './components/header'
import { ReceiptFooterComponent } from './components/footer'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import { Receipt } from '@models/finance/receipt.model'
import { Quotation } from '@models/finance/quotation.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import { EPaymentMethod } from '@enums/payments'
import { EShipmentStatus } from '@enums/shipments'

interface GenerateReceiptResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateReceipt(
  billing: Billing,
  receipt?: Receipt,
  session?: ClientSession,
): Promise<GenerateReceiptResponse> {
  const _receipts = billing.receipts as Receipt[]
  const _quotation = billing.quotation as Quotation
  const _receipt = receipt ? receipt : (last(sortBy(_receipts, 'createdAt')) as Receipt | undefined)
  if (!_quotation) {
    const message = 'ไม่พบข้อมูลใบเสนอราคา'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  if (!_receipt) {
    const message = 'ไม่พบข้อมูลใบเสร็จ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  const _document = _receipt.document as BillingDocument | undefined
  const isReceiveWHTDocument = !isEmpty(_document?.receivedWHTDocumentDate)

  let isAdditionalPaid = false
  if (billing.paymentMethod === EPaymentMethod.CASH) {
    const _receiptsLength = _receipts.length || 0
    if (_receiptsLength > 1) {
      isAdditionalPaid = true
    }
    //)
    // const _shipment = await ShipmentModel.findOne({
    //   trackingNumber: billing.billingNumber,
    //   paymentMethod: EPaymentMethod.CASH,
    // })
    // if (_shipment) {
    //   if (_shipment.status === EShipmentStatus.DELIVERED) {
    //     isAdditionalPaid = true
    //   }
    // }
  }

  const fileName = `receipt_${_receipt.receiptNumber}.pdf`
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

    let details = ''
    let amount = 0
    if (shipment.status === EShipmentStatus.DELIVERED) {
      // กรณีงานสำเร็จ: แสดงเป็นค่าขนส่งปกติ
      const dropoffs = tail(shipment.destinations)
      const latestQuotation = last(sortBy(shipment.quotations, 'createdAt')) as Quotation | undefined
      details = `ค่าขนส่ง${vehicle.name} ${pickup.name} ไปยัง ${reduce(
        dropoffs,
        (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
        '',
      )}`
      amount = latestQuotation?.price?.subTotal || 0
    } else if (shipment.status === EShipmentStatus.CANCELLED && shipment.cancellationFee > 0) {
      // กรณีงานยกเลิกและมีค่าปรับ: แสดงเป็นค่าปรับ
      details = `ค่าปรับจากการยกเลิกงาน #${shipment.trackingNumber}`
      amount = shipment.cancellationFee
    } else {
      // กรณีอื่นๆ (เช่น งานยกเลิกแต่ไม่มีค่าปรับ) จะไม่แสดงในรายการ
      return null
    }

    const issueInBEDateMonth = fDate(shipment.bookingDateTime, 'dd/MM')
    const issueInBEYear = toNumber(fDate(shipment.bookingDateTime, 'yyyy')) + 543

    return {
      no: { label: String(no), options },
      bookingDateTime: { label: `${issueInBEDateMonth}/${issueInBEYear}`, options },
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
  await ReceiptFooterComponent(doc, _quotation, _receipt, isReceiveWHTDocument, isAdditionalPaid)
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
  await ReceiptFooterComponent(doc, _quotation, _receipt, isReceiveWHTDocument, isAdditionalPaid)

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
