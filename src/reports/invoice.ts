import { get, reduce, head, tail, clone, round, last, sortBy, toNumber, includes } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { HeaderComponent } from './components/header'
import { COLORS, FONTS } from './components/constants'
import { Billing } from '@models/finance/billing.model'
import { Quotation } from '@models/finance/quotation.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { Invoice } from '@models/finance/invoice.model'
import { InvoiceFooterComponent } from './components/footer'
import { EQuotationStatus, EShipmentStatus } from '@enums/shipments'

interface GenerateInvoiceResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

/**
 * `billing` should be an object of Billing model (`lean` function is cannot be used)
 * @param billing
 * @param session
 * @returns GenerateInvoiceResponse
 */
export async function generateInvoice(
  billing: Billing,
  filename?: string,
  session?: ClientSession,
): Promise<GenerateInvoiceResponse> {
  const isTaxIncluded = billing.amount.tax > 0
  const _invoice = billing.invoice as Invoice | undefined
  if (!_invoice) {
    const message = 'ไม่สามารถหาข้อมูลใบแจ้งหนี้ได้ เนื่องจากไม่พบใบแจ้งหนี้'
    throw new GraphQLError(message, {
      extensions: { code: 'NOT_FOUND', errors: [{ message }] },
    })
  }

  const _document = _invoice.document as BillingDocument | undefined

  const fileName = filename ? filename : `invoice_${_invoice.invoiceNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/invoice', fileName)

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 56, left: 22, right: 22 },
    autoFirstPage: false,
  })

  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)
  doc.addPage()

  doc.font(FONTS.SARABUN_LIGHT).fontSize(8)

  const _billingShipments = (billing.shipments || []) as Shipment[]

  const _shipments = _billingShipments.map((shipment, index) => {
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
      const latestQuotation = last(sortBy(shipment.quotations as Quotation[], 'createdAt').filter((_quotation) => includes([EQuotationStatus.ACTIVE], _quotation.status))) as Quotation | undefined
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
      subtotal: { label: fCurrency(amount), options },
      total: { label: fCurrency(amount), options },
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
  HeaderComponent(doc, billing, 'invoice', currentPage, currentPage, isOiginal)

  await doc.on('pageAdded', () => {
    currentPage++
    if (!nomoredata) {
      HeaderComponent(doc, billing, 'invoice', currentPage, currentPage, isOiginal)
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
  await InvoiceFooterComponent(doc, billing, isTaxIncluded)
  isOiginal = false

  await doc.addPage()
  nomoredata = false
  await HeaderComponent(doc, billing, 'invoice', currentPage, currentPage, isOiginal)

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
  await InvoiceFooterComponent(doc, billing, isTaxIncluded)

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
