import fs from 'fs'
import path from 'path'
import { clone, range, round, toNumber } from 'lodash'
import PDFDocument, { Table, DataOptions } from 'pdfkit-table'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import { ASSETS, COLORS, FONTS } from './components/constants'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { ClientSession } from 'mongoose'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import { User } from '@models/user.model'
import { DriverPayment } from '@models/driverPayment.model'
import { Transaction } from '@models/transaction.model'
import ThaiBahtText from 'thai-baht-text'

interface GenerateReceiptResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateDriverReceipt(
  driverPayment: DriverPayment,
  session?: ClientSession,
): Promise<GenerateReceiptResponse> {
  // const _quotation = billing.quotation as Quotation
  // if (!_quotation) {
  //   const message = 'ไม่พบข้อมูลใบเสนอราคา'
  //   throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  // }
  const driver = driverPayment.driver as User
  if (!driver) {
    const message = 'ไม่พบข้อมูลคนขับ'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }
  //   if (!receipt) {
  //     const message = 'ไม่พบข้อมูลใบเสร็จ'
  //     throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  //   }

  const fileName = `${driverPayment.paymentNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/receipt', fileName)

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    autoFirstPage: false,
  })

  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)
  doc.addPage()
  doc.font(FONTS.SARABUN_LIGHT).fontSize(8)

  const trxs = (driverPayment.transactions || []) as Transaction[]

  const _tableOptions: DataOptions = {
    fontFamily: FONTS.SARABUN_LIGHT,
    fontSize: 9,
    separation: false,
  }
  const _trxTable = trxs.map((trx, index) => {
    const issueInBEDateMonth = fDate(trx.createdAt, 'dd/MM')
    const issueInBEYear = toNumber(fDate(trx.createdAt, 'yyyy')) + 543
    const displayDate = `${issueInBEDateMonth}/${issueInBEYear}`

    const detail = `${displayDate} - ${trx.description}`

    return {
      createdDate: { label: displayDate, options: _tableOptions },
      details: { label: detail, options: { ..._tableOptions, align: 'left' } },
      amount: { label: fCurrency(trx.amountBeforeTax, true), options: _tableOptions },
      remark: { label: '', options: _tableOptions },
    }
  })

  // Tax before
  _trxTable.push({
    createdDate: { label: '', options: _tableOptions },
    details: { label: 'ภาษีหัก ณ ที่จ่าย 1%', options: { ..._tableOptions, align: 'left' } },
    amount: { label: fCurrency(driverPayment.tax, true), options: _tableOptions },
    remark: { label: '', options: _tableOptions },
  })

  const _maxRecord = 10
  const _emtyRecord = _maxRecord - (_trxTable.length + 2)
  if (_emtyRecord > 0) {
    // Add Ped Empty
    range(0, _emtyRecord).forEach(() =>
      _trxTable.push({
        createdDate: { label: ' ', options: _tableOptions },
        details: { label: ' ', options: { ..._tableOptions, align: 'left' } },
        amount: { label: ' ', options: _tableOptions },
        remark: { label: ' ', options: _tableOptions },
      }),
    )
  }

  // Tax before
  _trxTable.push({
    createdDate: { label: '', options: _tableOptions },
    details: { label: 'รวมทั้งสิ้น', options: { ..._tableOptions, align: 'center', fontFamily: FONTS.SARABUN_MEDIUM } },
    amount: { label: fCurrency(driverPayment.total, true), options: _tableOptions },
    remark: { label: '', options: _tableOptions },
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
    { label: 'วัน เดือน ปี', property: 'createdDate', width: getColumnPercent(15), ...headerOption },
    { label: 'รายละเอียดรายจ่าย', property: 'details', width: getColumnPercent(45), ...headerOption },
    { label: 'จำนวนเงิน (บาท)', property: 'amount', width: getColumnPercent(20), ...headerOption, align: 'right' },
    { label: 'หมายเหตุ', property: 'remark', width: getColumnPercent(20), ...headerOption },
  ]

  const table: Table = { headers: _headers, datas: _trxTable as any }

  const headerHeight = clone(doc.y - doc.page.margins.top)

  const CONSTANTS = {
    TITLE: 'ใบสำคัญรับเงิน',
    NUMBER: 'เลขที่',
    DATE: 'วันที่',
    DRIVER_NAME: 'ชื่อผู้ให้บริการ',
    TAX_NUMBER: 'เลขประจำตัวผู้เสียภาษี',
    ADDRESS: 'ที่อยู่',
    RECEIVER_MONEY_FROM: 'ได้รับเงินจาก',
    RECEIVER_MONEY_FROM_NAME: 'บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด',
    RECEIVER_MONEY_FROM_LABEL: '(ผู้รับบริการ)',
    RECEIVER_MONEY_FROM_TAX: '0105564086723',
    RECEIVER_MONEY_FROM_ADDRESS: 'เลขที่ 156 ซอยลาดพร้าว 96 แขวงพลับพลา เขตวังทองหลาง จังหวัดกรุงเทพมหานคร 10310',
    LIST_OF_ABOVE: 'ดังรายการต่อไปนี้',
    TOTAL_TEXT: 'จำนวนเงิน(ตัวอักษร)',
    SIGN_LINEAR: '(ลงชื่อ)',
    SIGN_TRAILING: 'ผู้รับเงิน',
  }

  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(14)
    .text(CONSTANTS.TITLE, marginLeft, 60, { align: 'center', width: maxWidth })
  doc.moveDown(1.5)

  const docHeaderLabelX = maxWidth - 140
  const docHeaderValueX = maxWidth - 35

  // Number Section
  const _docNumberY = doc.y
  doc
    .font(FONTS.SARABUN_MEDIUM)
    .fontSize(9)
    .text(CONSTANTS.NUMBER, docHeaderLabelX, _docNumberY, { align: 'right', width: 100 })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .text(driverPayment?.paymentNumber || '-', docHeaderValueX, _docNumberY, { align: 'left' })
  doc.moveDown(0.3)

  // Dates
  const _docDateY = doc.y
  const receiptInBEDateMonth = fDate(driverPayment.createdAt, 'dd/MM')
  const receiptInBEYear = toNumber(fDate(driverPayment.createdAt, 'yyyy')) + 543
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.DATE, docHeaderLabelX, _docDateY, { align: 'right', width: 100 })
  doc
    .font(FONTS.SARABUN_LIGHT)
    .text(`${receiptInBEDateMonth}/${receiptInBEYear}`, docHeaderValueX, _docDateY, { align: 'left' })

  const _driver = driverPayment.driver as User

  // Driver Info
  doc.moveDown(1.5)
  const _driveNameY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.DRIVER_NAME, marginLeft, _driveNameY)
  doc.font(FONTS.SARABUN_MEDIUM).text(_driver.fullname, marginLeft + 50, _driveNameY)
  doc.moveDown(0.5)
  const _driverTaxY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.TAX_NUMBER, marginLeft, _driverTaxY)
  doc.font(FONTS.SARABUN_MEDIUM).text(_driver.taxId || '-', marginLeft + 84, _driverTaxY)
  doc.moveDown(0.5)
  const _driverAddressY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.ADDRESS, marginLeft, _driverAddressY)
  doc.font(FONTS.SARABUN_MEDIUM).text(_driver.address, marginLeft + 18, _driverAddressY)
  doc.moveDown(2)

  // MM Info
  const _providerNameY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.RECEIVER_MONEY_FROM, marginLeft, _providerNameY)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.RECEIVER_MONEY_FROM_NAME, marginLeft + 50, _providerNameY)
  doc.moveDown(0.5)
  const _providerTaxIDY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.TAX_NUMBER, marginLeft, _providerTaxIDY)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.RECEIVER_MONEY_FROM_TAX, marginLeft + 84, _providerTaxIDY)
  doc.moveDown(0.5)
  const _providerAddressY = doc.y
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.ADDRESS, marginLeft, _providerAddressY)
  doc.font(FONTS.SARABUN_MEDIUM).text(CONSTANTS.RECEIVER_MONEY_FROM_ADDRESS, marginLeft + 18, _providerAddressY)
  doc.moveDown(2.1)
  doc.font(FONTS.SARABUN_LIGHT).text(CONSTANTS.LIST_OF_ABOVE, marginLeft)
  doc.moveDown(2)

  const _tableStartY = doc.y
  await doc.table(table, {
    minHeaderHeight: headerHeight,
    minRowTHHeight: 20,
    minRowHeight: 18,
    divider: {
      header: { disabled: false, width: 1 },
      horizontal: { disabled: false, width: 1 },
    },
    prepareHeader: () => {
      const endY = doc.y - 4
      const rowHeight = 26
      const tableWidth = marginLeft + maxWidth
      doc.lineCap('butt').lineWidth(0.5).moveTo(marginLeft, endY).lineTo(tableWidth, endY).stroke('#333')
      doc
        .lineCap('butt')
        .lineWidth(0.5)
        .moveTo(marginLeft, endY)
        .lineTo(marginLeft, endY + rowHeight)
        .stroke('#333')
      doc
        .lineCap('butt')
        .lineWidth(0.5)
        .moveTo(tableWidth, endY)
        .lineTo(tableWidth, endY + rowHeight)
        .stroke('#333')
      return doc.font(FONTS.SARABUN_MEDIUM).fontSize(10)
    },
    prepareRow: function (row, indexColumn, indexRow, rectRow, rectCell) {
      let currentX = rectRow.x
      const rowY = rectRow.y
      const rowHeight = rectRow.height
      const tableWidth = marginLeft + maxWidth

      doc
        .lineCap('butt')
        .lineWidth(0.5)
        .moveTo(currentX, rowY)
        .lineTo(currentX, rowY + rowHeight)
        .strokeOpacity(0.7)
        .stroke('#333')
      doc
        .lineCap('butt')
        .lineWidth(0.5)
        .moveTo(tableWidth, rowY)
        .lineTo(tableWidth, rowY + rowHeight)
        .strokeOpacity(0.7)
        .stroke('#333')

      return doc
    },
  })
  drawTableVerticalLine(doc, _tableStartY - 4)
  doc.moveDown(2)

  // Amount in Thai Text
  doc
    .fontSize(9)
    .font(FONTS.SARABUN_LIGHT)
    .text(
      `จำนวนเงิน(ตัวอักษร)..........................${ThaiBahtText(driverPayment.total)}..........................`,
      marginLeft,
      doc.y,
      {
        align: 'left',
        width: maxWidth,
      },
    )

  /**
   * Signature: Customer
   */
  doc.moveDown(3)

  const signatureX = maxWidth / 2
  const signatureWidth = maxWidth - signatureX

  doc
    .fontSize(9)
    .text(
      '(ลงชื่อ)...........................................................................(ผู้รับเงิน)',
      marginLeft + 200,
      doc.y,
      {
        width: signatureWidth,
        align: 'center',
      },
    )
  doc
    .moveDown(2)
    .text(
      '(...........................................................................)',
      marginLeft + 200,
      doc.y - 9,
      {
        width: signatureWidth,
        align: 'center',
      },
    )

  doc.moveDown(3)

  doc
    .fontSize(9)
    .text(
      '(ลงชื่อ)...........................................................................(ผู้จ่ายเงิน)',
      marginLeft + 200,
      doc.y,
      {
        width: signatureWidth,
        align: 'center',
      },
    )
  doc
    .moveDown(2)
    .text(
      '(...........................................................................)',
      marginLeft + 200,
      doc.y - 9,
      {
        width: signatureWidth,
        align: 'center',
      },
    )

  doc.image(ASSETS.THEPPAWNCHAI_CREDENTIAL_2, signatureX + 104, doc.y - 74, { width: 100 })

  doc.end()
  await new Promise((resolve) => writeStream.on('finish', resolve))

  const _document = driverPayment.receiptDocument as BillingDocument | undefined
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

function drawTableVerticalLine(doc: PDFDocument, startYofTable: number) {
  const _marginLeft = doc.page.margins.left
  const _maxWidth = doc.page.width - _marginLeft

  doc.save()
  const _tableEndY = doc.y - 12
  const _column1X = 126
  const _column2X = 364
  const _column3X = 446
  doc.lineCap('butt').lineWidth(0.5).moveTo(_column1X, startYofTable).lineTo(_column1X, _tableEndY).stroke()
  doc.lineCap('butt').lineWidth(0.5).moveTo(_column2X, startYofTable).lineTo(_column2X, _tableEndY).stroke()
  doc.lineCap('butt').lineWidth(0.5).moveTo(_column3X, startYofTable).lineTo(_column3X, _tableEndY).stroke()
  doc.restore()
}
