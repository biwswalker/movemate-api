import PDFDocument, { Table, Data } from 'pdfkit-table'
import { ASSETS, COLORS, FONTS } from './constants'
import ThaiBahtText from 'thai-baht-text'
import { round } from 'lodash'
import { fDate } from '@utils/formatTime'

function headerText(doc: PDFDocument) {
  const _marginLeft = doc.page.margins.left
  const _marginTop = doc.page.margins.top
  const _lineY1 = _marginTop
  doc
    .text('ฉบับที่ 1 (', _marginLeft, _lineY1)
    .text('สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี', _marginLeft + 30, _lineY1)
    .text(')', _marginLeft + 230, _lineY1)

  const _lineY2 = doc.y
  doc
    .text('ฉบับที่ 2 (', _marginLeft, _lineY2)
    .text('สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน', _marginLeft + 30, _lineY2)
    .text(')', _marginLeft + 172, _lineY2)
  doc.moveDown(0.1)
}

interface HeaderData {
  whtNumber?: string
  whtBookNo?: string
}

function header(doc: PDFDocument, data: HeaderData) {
  const _marginLeft = doc.page.margins.left
  const _marginRight = doc.page.margins.right
  const _maxWidth = doc.page.width - _marginRight

  const _headerWidth = _maxWidth - 115

  doc
    .fontSize(18)
    .text('หนังสือรับรองการหักภาษี ณ ที่จ่าย', _marginLeft, doc.y, { width: _headerWidth, align: 'center' })
  doc.moveDown(0.2)
  doc
    .fontSize(12)
    .text('ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร', _marginLeft, doc.y - 8, { width: _headerWidth, align: 'center' })
  doc.text('เล่มที่', _headerWidth, doc.y - 28, { width: 28, align: 'right' })
  doc.fontSize(14).text(data.whtBookNo ?? '-', _headerWidth + 30, doc.y - 16, { width: 84, align: 'left' })
  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .moveTo(_headerWidth + 30, doc.y)
    .lineTo(_maxWidth - 3, doc.y)
    .stroke()
  doc.moveDown(0.1)
  doc.fontSize(12).text('เลขที่', _headerWidth, doc.y, { width: 28, align: 'right' })
  doc.fontSize(14).text(data.whtNumber ?? '-', _headerWidth + 30, doc.y - 18, { width: 84, align: 'left' })
  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .moveTo(_headerWidth + 30, doc.y)
    .lineTo(_maxWidth - 3, doc.y)
    .stroke()
  doc.moveDown(0.2)
}

interface WHTInfo {
  title: string
  name: string
  idnumber?: string
  taxid?: string
  address?: string
  taxType?: string
}

function generateCustomerInfo(doc: PDFDocument, data: WHTInfo) {
  const _fullContentMarginLeft = doc.page.margins.left
  const _fullContentMarginRight = doc.page.margins.right
  const _fullContentWidth = doc.page.width
  const _contentWidth = _fullContentWidth - (_fullContentMarginLeft + _fullContentMarginRight) - 4
  const _marginLeft = doc.page.margins.left + 2
  const _marginLeftText = _marginLeft + 6

  const _column1 = _contentWidth - 220
  const _column2 = 110
  const _column3 = 110
  const _rectStartY = doc.y
  doc.moveDown(0.2)

  const _line1Y = doc.y
  const _titleWidth = 18
  const _column1X = _marginLeftText + _titleWidth
  const _column2X = _marginLeftText + _column1
  const _column3X = _column2X + _column2

  doc
    .fontSize(13)
    .text(data.title, _marginLeftText, _line1Y, { width: _column1, align: 'left' })
    .text('เลขประจำตัวประชาชน', _column2X, _line1Y, { width: _column2, align: 'right' })
    .fontSize(17)
    .text(data.idnumber ?? '-', _column3X + 4, _line1Y - 3.5, { width: _column3, align: 'left' })
  // doc.moveDown(0.2)

  const _line2Y = doc.y

  doc
    .fontSize(13)
    .text('ชื่อ', _marginLeftText, _line2Y)
    // .fontSize(17)
    .text(data.name, _column1X, _line2Y, {
      width: _column1 - _titleWidth,
      align: 'left',
    })
    .fontSize(13)
    .text('เลขประจำตัวผู้เสียภาษีอากร', _column2X, _line2Y, { width: _column2, align: 'right' })
    .fontSize(17)
    .text(data.taxid ?? '-', _column3X + 4, _line2Y - 3.5, { width: _column3, align: 'left' })
  // doc.moveDown(0.2)

  const _line3Y = doc.y
  doc
    .fontSize(13)
    .text('ที่อยู่', _marginLeftText, _line3Y)
    // .fontSize(17)
    .text(data.address ?? '-', _column1X, _line3Y)
  doc.moveDown(0.2)

  if (data.taxType) {
    const _line4Y = doc.y
    const _line4YText = _line4Y - 2
    const _checkBoxSize = 15
    doc
      .fontSize(13)
      .text('ลำดับที่', _marginLeftText, _line4YText)
      .rect(58, _line4Y, 67, 15)
      .stroke()
      .text('ในแบบ', 130, _line4YText)
      .rect(172.5, _line4Y, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(1) ภ.ง.ด. 1ก.', 190, _line4YText)
      .rect(252.5, _line4Y, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(2) ภ.ง.ด. 1ก.พิเศษ', 270, _line4YText)
      .rect(352.5, _line4Y, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(3) ภ.ง.ด. 2', 370, _line4YText)
      .rect(432.5, _line4Y, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(4) ภ.ง.ด. 2ก.', 450, _line4YText)
    doc.moveDown(0.4)

    const _tempSection2YLine2 = doc.y
    const _tempSection2YLine2Text = doc.y - 2
    doc
      .rect(172.5, _tempSection2YLine2, _checkBoxSize, _checkBoxSize)
      .stroke()
      .save()
      .translate(172.5, _tempSection2YLine2)
      .scale(0.65)
      .path(
        'M9.55 15.15L18.025 6.675Q18.325 6.375 18.725 6.375T19.425 6.675T19.725 7.388T19.425 8.1L10.25 17.3Q9.95 17.6 9.55 17.6T8.85 17.3L4.55 13Q4.25 12.7 4.262 12.288T4.575 11.575T5.288 11.275T6 11.575L9.55 15.15Z',
      )
      .fill('black')
      .stroke()
      .restore()
      .text('(5) ภ.ง.ด. 3', 190, _tempSection2YLine2Text)
      .rect(252.5, _tempSection2YLine2, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(6) ภ.ง.ด. 3ก.', 270, _tempSection2YLine2Text)
      .rect(352.5, _tempSection2YLine2, _checkBoxSize, _checkBoxSize)
      .stroke()
      .text('(7) ภ.ง.ด. 53', 370, _tempSection2YLine2Text)
    doc.moveDown(0.5)
  }

  doc
    .rect(_marginLeft, _rectStartY, _contentWidth, doc.y - _rectStartY)
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.2)
}

function ProvidentInfo(doc: PDFDocument) {
  const _fullContentMarginLeft = doc.page.margins.left
  const _fullContentMarginRight = doc.page.margins.right
  const _fullContentWidth = doc.page.width
  const _contentWidth = _fullContentWidth - (_fullContentMarginLeft + _fullContentMarginRight) - 4
  const _marginLeft = doc.page.margins.left + 2
  const _marginLeftText = _marginLeft + 6

  const _providentLine1Y = doc.y
  const _rectStartY = doc.y
  const _checkBoxSize = 10

  doc.moveDown(0.2)
  doc.fontSize(11)
  doc
    .rect(_marginLeftText, _providentLine1Y + 4, _checkBoxSize, _checkBoxSize)
    .stroke()
    .text(
      'เงินสะสมจ่ายเข้ากองทุนสำรองเลี้ยงชีพ ใบอนุญาตเลขที่_________________________________',
      _marginLeftText + 15,
      _providentLine1Y + 1,
    )
    .text('จำนวนเงิน_____________________บาท', _marginLeftText + 360, _providentLine1Y + 2)
  const _providentLine2Y = doc.y - 2
  doc
    .rect(_marginLeftText, _providentLine2Y + 5, _checkBoxSize, _checkBoxSize)
    .stroke()
    .text('เงินสมทบจ่ายเข้ากองทุนประกันสังคม จำนวน_____________________บาท', _marginLeftText + 15, _providentLine2Y + 2)
  const _providentLine3Y = doc.y - 2
  doc.text(
    'เลขที่บัญชีนายจ้าง____________________________________________เลขที่บัตรประกันสังคม ของผู้ถูกหักภาษี ณ ที่จ่าย_____________________',
    _marginLeftText + 15,
    _providentLine3Y + 2,
  )
  doc.moveDown(0.2)
  doc
    .rect(_marginLeft, _rectStartY, _contentWidth, doc.y - _rectStartY)
    .lineWidth(0.5)
    .stroke()
}

function PayerType(doc: PDFDocument) {
  const _fullContentMarginLeft = doc.page.margins.left
  const _fullContentMarginRight = doc.page.margins.right
  const _fullContentWidth = doc.page.width
  const _contentWidth = _fullContentWidth - (_fullContentMarginLeft + _fullContentMarginRight) - 4
  const _marginLeft = doc.page.margins.left + 2
  const _marginLeftText = _marginLeft + 6

  const _providentLine1Y = doc.y
  const _rectStartY = doc.y
  const _checkBoxSize = 15

  doc.moveDown(0.2)
  doc.fontSize(11)
  doc
    .text('ผู้จ่ายเงิน', _marginLeftText, _providentLine1Y + 1)
    .rect(_marginLeftText + 50, _providentLine1Y + 2, _checkBoxSize, _checkBoxSize)
    .stroke()
    .save()
    .translate(_marginLeftText + 50, _providentLine1Y + 2)
    .scale(0.65)
    .path(
      'M9.55 15.15L18.025 6.675Q18.325 6.375 18.725 6.375T19.425 6.675T19.725 7.388T19.425 8.1L10.25 17.3Q9.95 17.6 9.55 17.6T8.85 17.3L4.55 13Q4.25 12.7 4.262 12.288T4.575 11.575T5.288 11.275T6 11.575L9.55 15.15Z',
    )
    .fill('black')
    .stroke()
    .restore()
    .text('(1) หัก ณ ที่จ่าย', _marginLeftText + 70, _providentLine1Y + 1)
    .rect(_marginLeftText + 130, _providentLine1Y + 2, _checkBoxSize, _checkBoxSize)
    .stroke()
    .text('(2) ออกให้ตลอดไป', _marginLeftText + 150, _providentLine1Y + 1)
    .rect(_marginLeftText + 230, _providentLine1Y + 2, _checkBoxSize, _checkBoxSize)
    .stroke()
    .text('(3) ออกให้ครั้งเดียว', _marginLeftText + 250, _providentLine1Y + 1)
    .rect(_marginLeftText + 330, _providentLine1Y + 2, _checkBoxSize, _checkBoxSize)
    .stroke()
    .text('(4) อื่นๆ (ระบุ)__________________________', _marginLeftText + 350, _providentLine1Y + 1)
  doc.moveDown(0.4)
  doc
    .rect(_marginLeft, _rectStartY, _contentWidth, doc.y - _rectStartY)
    .lineWidth(0.5)
    .stroke()
}

function TotalSection(doc: PDFDocument, totalBaht: number, tableStartY: number) {
  const _marginLeft = doc.page.margins.left
  const _marginRight = doc.page.margins.right
  const _maxWidth = doc.page.width - (_marginLeft + _marginRight)

  doc.save()
  doc
    .font(FONTS.ANGSANA_NEW)
    .fontSize(10)
    .text('รวมเงินที่จ่าย และ ภาษีที่นำส่ง', _maxWidth - 245, doc.y - 23, { align: 'right', width: 122 })
  doc.restore()
  const _totalTextLine = doc.y + 6
  doc
    .text('รวมเงินภาษีที่นำส่ง (ตัวอักษร)', _marginLeft + 6, _totalTextLine)
    .fontSize(13)
    .text(ThaiBahtText(totalBaht), _marginLeft + 122, _totalTextLine - 2)
    .rect(_marginLeft + 120, _totalTextLine - 1, 380, 14)

  doc
    .rect(_marginLeft + 2, tableStartY, _maxWidth - 4, doc.y - tableStartY + 4)
    .lineWidth(0.5)
    .stroke()
}

interface RemarkData {
  signerName: string
  signDate: string
}

function Remark(doc: PDFDocument, data: RemarkData) {
  const _fullContentMarginLeft = doc.page.margins.left
  const _fullContentMarginRight = doc.page.margins.right
  const _fullContentWidth = doc.page.width
  const _contentWidth = _fullContentWidth - (_fullContentMarginLeft + _fullContentMarginRight) - 4
  const _marginLeft = doc.page.margins.left + 2
  const _marginLeftText = _marginLeft + 6

  const _remarkLine1Y = doc.y
  const _rectStartY = doc.y

  doc.save()
  doc.moveDown(0.2)
  doc.fontSize(10)
  doc
    .text('คำเตือน', _marginLeftText, _remarkLine1Y)
    .text(
      'ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ. ที่จ่าย \nฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ \nแห่งรัษฎากร ต้องรับโทษทางอาญา ตามมาตรา 35 \nแห่งประมวลรัษฎากร',
      _marginLeftText + 30,
      _remarkLine1Y,
      { width: 140 },
    )
  doc.moveDown(0.2)
  const _rectHeight = doc.y - _rectStartY
  doc.rect(_marginLeft, _rectStartY, 175, _rectHeight).lineWidth(0.5).stroke()

  doc.restore()
  const _longerWidthText = 'ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้น ถูกต้องตรงกับความจริงทุกประการ'
  const _longerWidth = doc.widthOfString(_longerWidthText)
  const _signPositionY = _marginLeftText + 185
  doc
    .text('ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้น ถูกต้องตรงกับความจริงทุกประการ', _signPositionY, _remarkLine1Y, {
      width: _longerWidth,
      align: 'center',
    })
    .text(
      'ลงชื่อ...................................................................ผู้มีหน้าที่หักภาษี ณ ที่จ่าย',
      _signPositionY,
      _remarkLine1Y + 14,
      { width: _longerWidth, align: 'center' },
    )
    .text('...................................................................', _signPositionY, _remarkLine1Y + 26, {
      width: _longerWidth,
      align: 'center',
    })
    .text('(วัน เดือน ปี  ที่ออกหนังสือรับรองฯ)', _signPositionY, _remarkLine1Y + 35, {
      width: _longerWidth,
      align: 'center',
    })
  doc
    .fontSize(13)
    .text(data.signerName || '-', _marginLeftText + 215, _remarkLine1Y + 10, { width: 100, align: 'center' })
    .fontSize(15)
    .text(data.signDate || '-', _signPositionY, _remarkLine1Y + 19, { width: _longerWidth, align: 'center' })

  const _circleHeight = _rectHeight - 4
  const _stampX = _longerWidth + _signPositionY + 55
  doc.fontSize(13).text('ประทับตรา นิติบุคคล ถ้ามี', _stampX + 23, _remarkLine1Y + 2, {
    align: 'center',
    textIndent: 2,
    width: _circleHeight,
  })
  doc.save()
  doc.translate(_stampX, _remarkLine1Y - 20).circle(_circleHeight, _circleHeight, _circleHeight / 2)
  // doc.circle(_rectHeight, _rectHeight, _rectHeight / 2)
  doc.restore()
  doc
    .rect(_marginLeftText + 180, _rectStartY, 361, _rectHeight)
    .lineWidth(0.5)
    .stroke()
}

function drawTableLine(doc: PDFDocument, startYofTable: number) {
  const _marginLeft = doc.page.margins.left
  const _maxWidth = doc.page.width - _marginLeft

  doc.save()
  const _tableEndY = doc.y - 8
  const _column1X = 357
  const _column2X = 431
  const _column3X = 502
  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .moveTo(_column1X, startYofTable)
    .lineTo(_column1X, _tableEndY - 16)
    .stroke()
  doc.lineCap('butt').lineWidth(0.5).moveTo(_column2X, startYofTable).lineTo(_column2X, _tableEndY).stroke()
  doc.restore()
  doc.lineCap('butt').lineWidth(0.5).moveTo(_column3X, startYofTable).lineTo(_column3X, _tableEndY).stroke()
  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .moveTo(_marginLeft + 2, _tableEndY - 16)
    .lineTo(_maxWidth - 2, _tableEndY - 16)
    .stroke()
  doc
    .lineCap('butt')
    .lineWidth(0.5)
    .moveTo(_column2X, _tableEndY)
    .lineTo(_maxWidth - 2, _tableEndY)
    .stroke()
  doc.restore()
}

const getColumnPercent = (percent: number, contentWidth: number) => {
  return round((contentWidth - 4) * (percent / 100))
}

interface WHTData {
  totalBaht: number
  whtBookNo: string
  whtNumber: string
  fullname: string
  isBusinessCustomer: boolean
  taxId: string
  fullAddress: string
}

/**
 * Render Pages
 * @param doc PDFDocument
 * @param datas Table Data
 */
export async function renderWHTContent(doc: PDFDocument, whtInfo: WHTData, tableData: Data[]) {
  const _marginLeft = doc.page.margins.left
  const _marginRight = doc.page.margins.right
  const _maxWidth = doc.page.width - (_marginLeft + _marginRight)

  
  const _signer = {
    fullname: 'นาย สรณัฐ อินทร์ตลาดชุม',
    signDate: fDate(new Date(), 'dd/MM/yyyy'),
    // WHT Info
    whtName: 'บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด',
    whtAddress: 'เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310',
    whtTaxId: '0-1055-64086-72-3',
  }

  doc.font(FONTS.ANGSANA_NEW).fontSize(11)

  headerText(doc)

  // Declare frame
  const _originFrameY = doc.y
  whtInfo
  header(doc, { whtNumber: whtInfo.whtNumber, whtBookNo: whtInfo.whtBookNo })

  /**
   * ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:
   */
  generateCustomerInfo(doc, {
    title: 'ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:',
    name: _signer.whtName,
    address: _signer.whtAddress,
    taxid: _signer.whtTaxId,
  })
  /**
   * ผู้ถูกหักภาษี ณ ที่จ่าย:
   */
  generateCustomerInfo(doc, {
    title: 'ผู้ถูกหักภาษี ณ ที่จ่าย:',
    name: `${whtInfo.fullname} (${whtInfo.isBusinessCustomer ? 'นิติบุคคล' : 'บุคคล'})`,
    address: whtInfo.fullAddress,
    idnumber: undefined,
    taxid: whtInfo.taxId,
    taxType: '5',
  })

  const headerOption = {
    align: 'center',
    valign: 'middle',
    headerColor: COLORS.COMMON_WHITE,
  }

  const _headers = [
    {
      label: 'ประเภทเงินได้พึงประเมินที่จ่าย',
      property: 'details',
      width: getColumnPercent(61, _maxWidth),
      ...headerOption,
    },
    {
      label: 'วัน เดือน หรือปีภาษี ที่จ่าย',
      property: 'date',
      width: getColumnPercent(13, _maxWidth),
      ...headerOption,
    },
    { label: 'จำนวนเงินที่จ่าย', property: 'total', width: getColumnPercent(13, _maxWidth), ...headerOption },
    { label: 'ภาษีที่หัก และนำส่งไว้', property: 'wht', width: getColumnPercent(13, _maxWidth), ...headerOption },
  ]

  const table: Table = { headers: _headers, datas: tableData }

  const _tableStartY = doc.y
  await doc.table(table, {
    x: _marginLeft + 2,
    minHeaderHeight: doc.y,
    divider: {
      header: { disabled: false, width: 0.5, opacity: 1 },
      horizontal: { disabled: true },
    },
    prepareHeader: () => doc.font(FONTS.ANGSANA_NEW).fontSize(12),
  })
  drawTableLine(doc, _tableStartY)

  /**
   * Total
   */
  TotalSection(doc, whtInfo.totalBaht, _tableStartY)
  doc.moveDown(0.5)

  /**
   * Provident
   */
  ProvidentInfo(doc)
  doc.moveDown(0.2)

  /**
   * Payer
   */
  PayerType(doc)
  doc.moveDown(0.2)

  /**
   * Remark
   */
  Remark(doc, {
    signerName: _signer.fullname,
    signDate: _signer.signDate,
  })

  doc.save()
  doc.image(ASSETS.THEPPAWNCHAI, 450, doc.y - 120, { width: 130 })
  doc.restore()

  /** End Frame */
  doc.moveDown(0.3)
  doc
    .rect(_marginLeft, _originFrameY, _maxWidth, doc.y - _originFrameY)
    .lineWidth(1)
    .stroke()
}
