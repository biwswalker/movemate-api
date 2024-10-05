import { get, isEmpty, reduce, toNumber, slice, forEach, head, tail } from 'lodash'
import PDFDocument from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { fCurrency } from '@utils/formatNumber'
import { fDate } from '@utils/formatTime'
import ThaiBahtText from 'thai-baht-text'
import BillingCycleModel, { BillingCycle } from '@models/billingCycle.model'
import { User } from '@models/user.model'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { BusinessCustomerCreditPayment } from '@models/customerBusinessCreditPayment.model'
import { IndividualCustomer } from '@models/customerIndividual.model'
import { Shipment } from '@models/shipment.model'
import { VehicleType } from '@models/vehicleType.model'
import { EPaymentMethod, Payment } from '@models/payment.model'
import { BillingReceipt } from '@models/billingReceipt.model'

const sarabunThin = path.join(__dirname, '..', 'assets/fonts/Sarabun-Thin.ttf')
const sarabunExtraLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraLight.ttf')
const sarabunLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-Light.ttf')
const sarabunRegular = path.join(__dirname, '..', 'assets/fonts/Sarabun-Regular.ttf')
const sarabunMedium = path.join(__dirname, '..', 'assets/fonts/Sarabun-Medium.ttf')
const sarabunSemiBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-SemiBold.ttf')
const sarabunBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-Bold.ttf')
const sarabunExtraBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraBold.ttf')

export async function generateReceipt(billingCycle: BillingCycle, filname?: string) {
  const billingReceipt = get(billingCycle, 'billingReceipt', {}) as BillingReceipt

  const logoPath = path.join(__dirname, '..', 'assets/images/logo_bluesky.png')
  const fileName = filname ? filname : `receipt_${billingReceipt.receiptNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/receipt', fileName)

  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 56, left: 22, right: 22 } })
  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)

  let splitIndex: number[] = []
  let stackHeight = 0
  const maxHeight = 326
  doc.font(sarabunLight).fontSize(8)
  const billingShipments = get(billingCycle, 'shipments', []) as Shipment[]
  billingShipments.forEach((data, index) => {
    const pickup = head(data.destinations)
    const dropoffs = tail(data.destinations)
    const venicle = get(data, 'vehicleId', undefined) as VehicleType | undefined
    const details = `ค่าขนส่ง${venicle.name} ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? curr.name : `${prev}, ${curr.name}`),
      '',
    )}`
    const contentHeight = doc.heightOfString(details, { width: 260 })
    const totalHeight = contentHeight + stackHeight + 3
    if (totalHeight > maxHeight) {
      splitIndex = [...splitIndex, index]
      stackHeight = 0
    } else {
      stackHeight = totalHeight
      if (billingShipments.length - 1 === index) {
        splitIndex = [...splitIndex, index + 1]
      }
    }
  })

  const shipmentGroup = splitIndex.reduce<Shipment[][]>((prev, curr, currentIndex) => {
    if (currentIndex === 0) {
      const data = slice(billingShipments, 0, curr)
      return [data]
    } else {
      const data = slice(billingShipments, splitIndex[currentIndex - 1], curr)
      return [...prev, data]
    }
  }, [])

  let latestHeight = 0
  let rowNumber = 0

  function HeaderComponent(page: number, totalPage: number, isOriginal: boolean = true) {
    // Logo
    doc.image(logoPath, 22, 60, { width: 80 })

    // Company Movemate info
    doc.font(sarabunMedium).fontSize(8).text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จํากัด', 110)
    doc.font(sarabunLight).fontSize(7)
    doc.text('สาขา : (สำนักงานใหญ่)', 280, 61)
    doc.moveDown(0.8)
    doc.text('เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310', 110)
    doc.moveDown(0.6)
    doc.text('เลขประจําตัวผู้เสียภาษี: 0105564086723', 110)
    doc.moveDown(0.6)
    doc.text('ติดต่อ: 02-xxx-xxxx', 110)
    doc.moveDown(0.6)
    doc.text('อีเมล์: acc@movematethailand.com', 110)

    // Receipt number detail
    doc.font(sarabunRegular).fontSize(13).text('RECEIPT', 420, 55, { align: 'center', width: 162 })
    doc.moveDown(0.3)
    doc.font(sarabunLight).fontSize(9)
    doc.text(`ใบเสร็จรับเงิน ${isOriginal ? '(ต้นฉบับ)' : '(สำเนา)'}`, 420, doc.y, { align: 'center', width: 162 })
    doc
      .lineCap('butt')
      .lineWidth(1)
      .moveTo(420, doc.y + 4)
      .lineTo(582, doc.y + 4)
      .stroke()
    doc.moveDown(0.5)
    doc.fontSize(8)
    doc.font(sarabunMedium).text('Receipt No.:', 420, doc.y, { align: 'right', width: 74 }) // 81
    doc.font(sarabunLight).text(billingReceipt.receiptNumber, 504, doc.y - 10, { align: 'left' })

    const isCredit = billingCycle.paymentMethod === EPaymentMethod.CREDIT
    if (isCredit) {
      doc.moveDown(0.3)
      doc.font(sarabunMedium).text('Invoice No.:', 420, doc.y, { align: 'right', width: 74 }) // 81
      doc.font(sarabunLight).text(billingCycle.billingNumber, 504, doc.y - 10, { align: 'left' })
    }

    const receiptInBEDateMonth = fDate(billingReceipt.receiptDate, 'dd/MM')
    const receiptInBEYear = toNumber(fDate(billingReceipt.receiptDate, 'yyyy')) + 543
    doc.moveDown(0.3)
    doc.font(sarabunMedium).text('Date :', 420, doc.y, { align: 'right', width: 74 }) // 81
    doc.font(sarabunLight).text(`${receiptInBEDateMonth}/${receiptInBEYear}`, 504, doc.y - 10, { align: 'left' })
    doc.rect(420, 54, 162, 84).lineWidth(2).stroke()

    // Seperate line
    const linesephead = isCredit ? 16 : 29
    doc.lineCap('butt').lineWidth(1.5).moveTo(22, doc.y + linesephead).lineTo(584, doc.y + linesephead).stroke()

    let address = '-'
    const user = get(billingCycle, 'user', undefined) as User | undefined
    const businessDetail = get(user, 'businessDetail', undefined) as BusinessCustomer | undefined
    const paymentMethod = get(businessDetail, 'paymentMethod', '')
    if (paymentMethod === 'cash') {
      address = `${businessDetail.address} แขวง/ตำบล ${businessDetail.subDistrict} เขต/อำเภอ ${businessDetail.district} จังหวัด ${businessDetail.province} ${businessDetail.postcode}`
    } else if (paymentMethod === 'credit' && businessDetail.creditPayment) {
      const creditPayment = businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
      address = `${creditPayment.financialAddress} แขวง/ตำบล ${creditPayment.financialSubDistrict} เขต/อำเภอ ${creditPayment.financialDistrict} จังหวัด ${creditPayment.financialProvince} ${creditPayment.financialPostcode}`
    } else if (user.individualDetail) {
      const individualDetail = user.individualDetail as IndividualCustomer | undefined
      if (individualDetail.address) {
        address = `${individualDetail.address} แขวง/ตำบล ${individualDetail.subDistrict} เขต/อำเภอ ${individualDetail.district} จังหวัด ${individualDetail.province} ${individualDetail.postcode}`
      }
    }

    const isBusiness = user.userType === 'business'
    const businessBranch = get(user, 'businessDetail.businessBranch', '-')
    const taxId = isBusiness ? get(user, 'businessDetail.taxNumber', '-') : get(user, 'individualDetail.taxId', '-')
    // Customer detail
    doc.moveDown(isCredit ? 2.8 : 3.8)
    doc.font(sarabunMedium).fontSize(7)
    doc.text('ชื่อลูกค้า :', 22)
    doc.text(user.fullname, 110, doc.y - 9)
    doc.font(sarabunLight)
    if (isBusiness) {
      doc.text('สาขา :', 280, doc.y - 9)
      doc.text(businessBranch, 308, doc.y - 9)
    }
    doc.moveDown(0.6)
    doc.font(sarabunMedium).text('เลขประจำตัวผู้เสียภาษี :', 22)
    doc.font(sarabunLight).text(taxId, 110, doc.y - 9)
    doc.moveDown(0.6)
    doc.font(sarabunMedium).text('ที่อยู่ :', 22)
    doc.font(sarabunLight).text(address, 110, doc.y - 9)

    // Page detail
    doc.moveDown(2.1)
    doc.fontSize(8)
    doc.font(sarabunMedium).text('Page :', 0, doc.y, { width: 500, align: 'right' })
    doc.font(sarabunLight).text(`${page} of ${totalPage}`, 500, doc.y - 10, { align: 'center', width: 76 })
    doc.moveDown(0.5)
    doc.font(sarabunMedium).text('รายละเอียด', 22)
    doc.font(sarabunMedium).text('สกุลเงิน :', 0, doc.y - 10, { width: 500, align: 'right' })
    doc.font(sarabunLight).text('บาท (THB)', 500, doc.y - 10, { align: 'center', width: 76 })

    // Seperate line
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + 4)
      .lineTo(584, doc.y + 4)
      .stroke()

    doc.moveDown(1)
    doc.font(sarabunMedium).fontSize(7)
    doc.text('ลำดับ', 22, doc.y, { width: 32, align: 'center' })
    doc.text('วันที่ใช้บริการ', 54, doc.y - 9, { width: 64, align: 'center' })
    doc.text('หมายเลขงาน', 118, doc.y - 9, { width: 64, align: 'center' })
    doc.text('รายละเอียด', 182, doc.y - 9, { width: 260, align: 'center' })
    doc.text('จำนวนเงิน', 442, doc.y - 9, { width: 64, align: 'center' })
    doc.text('จำนวนเงินสุทธิ', 506, doc.y - 9, { width: 78, align: 'center' })
    doc.moveDown(0.5)

    // Seperate line
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + 4)
      .lineTo(584, doc.y + 4)
      .stroke()

    doc.moveDown(1)
  }

  function ContentComponent(isOriginal: boolean = true) {
    if (isEmpty(shipmentGroup)) {
      HeaderComponent(1, 1, isOriginal)
    }

    forEach(shipmentGroup, (shipments, index) => {
      if (index !== 0) {
        doc
          .lineCap('butt')
          .lineWidth(1.5)
          .moveTo(22, doc.y + latestHeight + 8)
          .lineTo(584, doc.y + latestHeight + 8)
          .stroke()
        doc.addPage()
      }
      HeaderComponent(index + 1, shipmentGroup.length, isOriginal)
      forEach(shipments, (shipment, itemIndex) => {
        const pickup = head(shipment.destinations)
        const dropoffs = tail(shipment.destinations)
        const venicle = get(shipment, 'vehicleId', undefined) as VehicleType | undefined
        const details = `ค่าขนส่ง${venicle.name} ${pickup.name} ไปยัง ${reduce(
          dropoffs,
          (prev, curr) => (prev ? curr.name : `${prev}, ${curr.name}`),
          '',
        )}`
        const contentHeight = doc.heightOfString(details, { width: 260 })
        latestHeight = contentHeight
        const currentY = doc.y + (itemIndex === 0 ? 0 : contentHeight)
        const no = rowNumber + 1
        const payment = get(shipment, 'payment', undefined) as Payment

        doc
          .moveDown(0.5)
          .font(sarabunLight)
          .fontSize(8)
          .text(`${no}`, 22, currentY, { width: 32, align: 'center' })
          .text(fDate(shipment.bookingDateTime, 'dd/MM/yyyy'), 54, currentY, { width: 64, align: 'center' })
          .text(shipment.trackingNumber, 118, currentY, { width: 64, align: 'center' })
          .text(details, 182, currentY, { width: 260, align: 'left' })
          .text(fCurrency(payment.invoice.totalPrice || 0), 442, currentY, { width: 64, align: 'right' })
          .text(fCurrency(payment.invoice.totalPrice || 0), 506, currentY, { width: 78, align: 'right' })
      })
    })
  }

  // Summary and Payment detail
  // Seperate line
  // doc.moveDown(2)

  function FooterComponent() {
    doc
      .lineCap('butt')
      .lineWidth(1.5)
      .moveTo(22, doc.y + latestHeight)
      .lineTo(584, doc.y + latestHeight)
      .stroke()

    // Total detail
    doc.fontSize(8)
    doc.font(sarabunMedium).text('รวมเป็นเงิน :', 0, doc.y + latestHeight + 16, { width: 450, align: 'right' })
    doc.font(sarabunLight).text(fCurrency(billingCycle.subTotalAmount), 450, doc.y - 10, { align: 'right', width: 128 })
    if (billingCycle.taxAmount > 0) {
      doc.moveDown(1.6)
      doc.font(sarabunMedium).text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 450, align: 'right' })
      doc
        .font(sarabunLight)
        .text(`-${fCurrency(billingCycle.taxAmount)}`, 450, doc.y - 10, { align: 'right', width: 128 })
    }
    doc.moveDown(2.6)
    doc.fontSize(10)
    doc.font(sarabunMedium).text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 450, align: 'right' })
    doc.font(sarabunSemiBold).text(fCurrency(billingCycle.totalAmount), 450, doc.y - 12, { align: 'right', width: 128 })
    doc
      .fontSize(7)
      .font(sarabunLight)
      .text(`( ${ThaiBahtText(billingCycle.totalAmount)} )`, 0, doc.y + 4, {
        align: 'right',
        width: 578,
      })

    // Policy detail
    doc.moveDown(3.5)
    doc.fontSize(7)
    doc.font(sarabunMedium).text('กรุณาออกเอกสารภาษีหัก ณ ที่จ่าย ในนาม', 22)
    doc.moveDown(0.5)
    doc
      .font(sarabunLight)
      .text('บริษัท', 22)
      .font(sarabunMedium)
      .text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด (สำนักงานใหญ่)', 94, doc.y - 9)
    doc.moveDown(0.3)
    doc.text('0105564086723', 94)
    doc.moveDown(0.3)
    doc
      .font(sarabunLight)
      .text('ที่อยู่', 22)
      .font(sarabunMedium)
      .text('เลขที่ 156 ซอยลาดพร้าว 96 ถนนลาดพร้าว แขวงพลับพลา เขตวังทองหลาง', 94, doc.y - 9)
    doc.moveDown(0.3)
    doc.text('จังหวัดกรุงเทพมหานคร 10310', 94)

    // After transfer detail
    doc.moveDown(4)
    doc.font(sarabunLight).fontSize(6).fillColor('#212B36')
    doc.text('1. หากต้องการแก้ไขใบแจ้งหนี้และใบเสร็จรับเงิน กรุณาติดต่อ acc@movematethailand.com ภายใน 3 วันทำการ', 22)
    doc.moveDown(1)
    doc.text(
      'หลังจากได้รับเอกสาร มิเช่นนั้นทางบริษัทฯ จะถือว่าเอกสารดังกล่าวถูกต้อง ครบถ้วน สมบรณ์ เป็นที่เรียบร้อยแล้ว',
      28,
    )
    doc.moveDown(1)
    doc.text(
      '2. เมื่อท่านได้ออกเอกสารภาษี หัก ณ ที่จ่ายแล้วให้ส่งเอกสารดังกล่าว มาที่ acc@movematethailand.com พร้อมอ้างอิงเลขที่ใบเสร็จรับเงิน',
      22,
    )
    doc.moveDown(1)
    doc.text('3. รบกวนส่งเอกสารภาษีหัก ณ ที่จ่ายฉบับจริงมาตามที่อยู่ในการออกเอกสารดังกล่าว')

    const halfWidth = doc.page.width / 2

    // Signatures
    doc.moveDown(7)
    doc.fontSize(7).fillColor('#000')
    doc
      .fillColor('#919EAB')
      .text('______________________________________________________________', 0, doc.y, {
        width: halfWidth,
        align: 'center',
      })
      .text('______________________________________________________________', halfWidth, doc.y - 9, {
        width: halfWidth,
        align: 'center',
      })
    doc.moveDown(0.8)
    doc
      .fillColor('#000')
      .text('(.............................................................................)', 0, doc.y, {
        width: halfWidth,
        align: 'center',
      })
      .text('(.............................................................................)', halfWidth, doc.y - 9, {
        width: halfWidth,
        align: 'center',
      })
    doc.moveDown(0.6)
    doc
      .text('วันที่ .................... / ............................ / ...................', 0, doc.y, {
        width: halfWidth,
        align: 'center',
      })
      .text('วันที่ .................... / ............................ / ...................', halfWidth, doc.y - 9, {
        width: doc.page.width / 2,
        align: 'center',
      })
    doc.moveDown(0.6)
    doc
      .fillColor('#212B36')
      .text('(ผู้ใช้บริการ)', 0, doc.y, { width: halfWidth, align: 'center' })
      .text('(ผู้ให้บริการ)', halfWidth, doc.y - 9, { width: halfWidth, align: 'center' })
  }

  // Start Render

  ContentComponent()
  FooterComponent()
  doc.addPage()
  ContentComponent(false)
  FooterComponent()

  doc.end()

  await new Promise((resolve) => writeStream.on('finish', resolve))

  await BillingCycleModel.findByIdAndUpdate(billingCycle._id, { issueReceiptFilename: fileName })

  return { fileName, filePath }
}
