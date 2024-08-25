import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import UserModel, { EUserRole, EUserStatus, EUserType, User } from './user.model'
import ShipmentModel, { EShipingStatus, Shipment } from './shipment.model'
import { BillingPayment } from './billingPayment.model'
import { BusinessCustomer } from './customerBusiness.model'
import { BusinessCustomerCreditPayment } from './customerBusinessCreditPayment.model'
import lodash, { get, isEmpty, property, range, reduce, size, sum, toNumber, toString } from 'lodash'
import { addDays, addMonths, format } from 'date-fns'
import { EPaymentMethod, Payment } from './payment.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GET_CUSTOMER_WITH_TODAY_BILLED_DATE } from '@pipelines/user.pipeline'
import { email_sender } from '@utils/email.utils'
import { th } from 'date-fns/locale'
import PDFDocument from 'pdfkit-table'
import fs from 'fs'
import path from 'path'

Aigle.mixin(lodash, {})

export enum EBillingStatus {
  CURRENT = 'current',
  OVERDUE = 'overdue',
  SUSPENDED = 'suspended',
  PAID = 'PAID',
}

@ObjectType()
export class BillingCycle extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ ref: () => User, required: true })
  user: Ref<User>

  @Field()
  @Property({ required: true })
  billingNumber: string

  @Field()
  @Property({ required: true })
  issueDate: Date

  @Field()
  @Property({ required: true })
  billingStartDate: Date

  @Field()
  @Property({ required: true })
  billingEndDate: Date

  @Field()
  @Property({ enum: EBillingStatus, required: true, default: EBillingStatus.CURRENT })
  billingStatus: EBillingStatus

  @Field(() => BillingPayment, { nullable: true })
  @Property({ ref: () => BillingPayment })
  billingPayment?: Ref<BillingPayment>

  @Field(() => [Shipment])
  @Property({ ref: () => Shipment, required: true, default: [] })
  shipments: Ref<Shipment>[]

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  subTotalAmount: number

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  taxAmount: number

  @Field(() => Float)
  @Property({ required: true, default: 0 })
  totalAmount: number

  @Field({ nullable: true })
  @Property()
  paymentDueDate?: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static async createBillingCycleForUser(userId: string) {
    const customer = await UserModel.findById(userId)
    if (customer && customer.userType === EUserType.BUSINESS && customer.userRole === EUserRole.CUSTOMER) {
      const businessDetail = customer.businessDetail as BusinessCustomer | undefined
      if (businessDetail) {
        const creditPayment = businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
        if (creditPayment) {
          const billingDate = get(creditPayment, `billedDate.${format(new Date(), 'MMM').toLowerCase()}`, 1)
          const duedateDate = get(creditPayment, `billedRound.${format(new Date(), 'MMM').toLowerCase()}`, 15)

          const billedDate = new Date().setDate(billingDate)
          const shipmentStartDeliveredDate = addMonths(billedDate, -1).setHours(0, 0, 0, 0)
          const shipmentEndDeliveredDate = addDays(billedDate, -1).setHours(23, 59, 59, 999)

          const shipments = await ShipmentModel.find({
            customer: userId,
            status: EShipingStatus.DELIVERED,
            deliveredDate: { $gte: shipmentStartDeliveredDate, $lte: shipmentEndDeliveredDate },
          }).populate({
            path: 'payment',
            match: { paymentMethod: EPaymentMethod.CREDIT },
          })

          const subTotalAmount = reduce(
            shipments,
            (prev, shipment) => {
              if (shipment.payment) {
                const payment = shipment.payment as Payment
                const payTotal = payment.calculation.totalPrice
                return prev + payTotal
              }
              return prev + 0
            },
            0,
          )

          let taxAmount = 0
          // Remark: WHT calculate, when > 1000
          if (subTotalAmount > 1000) {
            const wht = 1 / 100
            taxAmount = wht * subTotalAmount
          }

          const totalAmount = sum([subTotalAmount, taxAmount])

          const paymentDueDate = new Date(new Date().setDate(duedateDate)).setHours(23, 59, 59, 999)

          const _month = format(new Date(), 'MM')
          const _year = toNumber(format(new Date(), 'yyyy')) + 543
          const _billingNumber = await generateTrackingNumber(`IV${_month}${_year}`, 'invoice')
          const billingCycle = new BillingCycleModel({
            user: userId,
            billingNumber: _billingNumber,
            issueDate: billedDate,
            billingStartDate: shipmentStartDeliveredDate,
            billingEndDate: shipmentEndDeliveredDate,
            shipments,
            subTotalAmount,
            taxAmount,
            totalAmount,
            paymentDueDate,
            // billingStatus: '', Has Default
            // billingPayment: '', Not create for now
          })

          await billingCycle.save()

          // TODO: Sent email and notification
        }
      }
    }
  }
}

const BillingCycleModel = getModelForClass(BillingCycle)

export default BillingCycleModel

export async function issueBillingCycle() {
  /**
   * ISSUE
   */
  const customers = await UserModel.aggregate(GET_CUSTOMER_WITH_TODAY_BILLED_DATE())
  if (customers && !isEmpty(customers)) {
    await Aigle.forEach(customers as User[], async (customer) => {
      if (customer._id) {
        await BillingCycleModel.createBillingCycleForUser(customer._id)
      }
    })
  }
}

export async function checkBillingStatus() {
  const today = new Date()
  /**
   * OVERDUE CHECK
   */
  const overdueBillingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.CURRENT,
    paymentDueDate: { $lt: today }, // RECHECK AGAIN
  })

  await Aigle.forEach(overdueBillingCycles, async (overdueBill) => {
    await overdueBill.updateOne({ billingStatus: EBillingStatus.OVERDUE })
  })

  /**
   * SUSPENDED CHECK
   */
  const suspendedBillingCycles = await BillingCycleModel.find({
    billingStatus: EBillingStatus.OVERDUE,
    paymentDueDate: { $lt: addDays(today, -16) },
  })

  await Aigle.forEach(suspendedBillingCycles, async (suspendedBill) => {
    await suspendedBill.updateOne({ billingStatus: EBillingStatus.SUSPENDED })
    const customer = await UserModel.findById(suspendedBill.user)
    if (customer) {
      await customer.updateOne({ status: EUserStatus.BANNED })
    }
  })
}

export async function issueEmailToCustomer() {
  const emailTranspoter = email_sender()

  const billingCycles = await BillingCycleModel.find({
    issueDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)), // วันนี้
      $lt: new Date(new Date().setHours(23, 59, 59, 999)), // วันนี้
    },
  })

  await Aigle.forEach(billingCycles, async (billingCycle) => {
    const customer = await UserModel.findById(billingCycle.user)
    if (customer) {
      ;((customer.businessDetail as BusinessCustomer).creditPayment as BusinessCustomerCreditPayment)
        .financialContactEmails
      const financialEmails = get(customer, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = [customer.email, ...financialEmails]
      const month_text = format(new Date(), 'MMMM', { locale: th })
      const year_number = toNumber(format(new Date(), 'yyyy', { locale: th }))
      const year_text = toString(year_number + 543)
      await emailTranspoter.sendMail({
        from: process.env.NOREPLY_EMAIL,
        to: emails,
        subject: `[Auto Email] Movemate Thailand ใบแจ้งหนี้ค่าบริการ ${billingCycle.billingNumber}`,
        template: 'notify_invoice',
        context: {
          business_name: customer.fullname,
          month_text,
          year_text,
          financial_email: 'acc@movematethailand.com',
          contact_number: '02-xxx-xxxx',
          movemate_link: `https://www.movematethailand.com`,
        },
        // attachments: []
      })
    }
  })
}

const sarabunThin = path.join(__dirname, '..', 'assets/fonts/Sarabun-Thin.ttf')
const sarabunExtraLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraLight.ttf')
const sarabunLight = path.join(__dirname, '..', 'assets/fonts/Sarabun-Light.ttf')
const sarabunRegular = path.join(__dirname, '..', 'assets/fonts/Sarabun-Regular.ttf')
const sarabunMedium = path.join(__dirname, '..', 'assets/fonts/Sarabun-Medium.ttf')
const sarabunSemiBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-SemiBold.ttf')
const sarabunBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-Bold.ttf')
const sarabunExtraBold = path.join(__dirname, '..', 'assets/fonts/Sarabun-ExtraBold.ttf')

// export async function generateInvoice(billingCycle: BillingCycle) {
export async function generateInvoice() {
  const logoPath = path.join(__dirname, '..', 'assets/images/logo_bluesky.png')
  const kbankPath = path.join(__dirname, '..', 'assets/images/kbank-full.png')
  const filePath = path.join(__dirname, `invoice_IV086700001.pdf`)
  // const filePath = path.join(__dirname, `invoice_${billingCycle.billingNumber}.pdf`)

  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 56, left: 22, right: 22 } })
  const writeStream = fs.createWriteStream(filePath)
  doc.pipe(writeStream)

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

  // Invoice number detail
  doc.font(sarabunRegular).fontSize(13).text('INVOICE', 420, 55, { align: 'center', width: 162 })
  doc.moveDown(0.3)
  doc.font(sarabunLight).fontSize(9)
  doc.text('ใบแจ้งหนี้ (ต้นฉบับ)', 420, doc.y, { align: 'center', width: 162 })
  doc
    .lineCap('butt')
    .lineWidth(1)
    .moveTo(420, doc.y + 4)
    .lineTo(582, doc.y + 4)
    .stroke()
  doc.moveDown(0.5)
  doc.fontSize(8)
  doc.font(sarabunMedium).text('Invoice No.:', 420, doc.y, { align: 'right', width: 74 }) // 81
  doc.font(sarabunLight).text('IV2308009', 504, doc.y - 10, { align: 'left' })
  doc.moveDown(0.3)
  doc.font(sarabunMedium).text('Date :', 420, doc.y, { align: 'right', width: 74 }) // 81
  doc.font(sarabunLight).text('31/8/2566', 504, doc.y - 10, { align: 'left' })
  doc.moveDown(0.3)
  doc.font(sarabunMedium).text('Due Date :', 420, doc.y, { align: 'right', width: 74 }) // 81
  doc.font(sarabunLight).text('7/9/2566', 504, doc.y - 10, { align: 'left' })
  doc.rect(420, 54, 162, 84).lineWidth(2).stroke()

  // Seperate line
  doc
    .lineCap('butt')
    .lineWidth(1.5)
    .moveTo(22, doc.y + 16)
    .lineTo(584, doc.y + 16)
    .stroke()

  // Customer detail
  doc.moveDown(2.8)
  doc.font(sarabunMedium).fontSize(7)
  doc.text('ชื่อลูกค้า :', 22)
  doc.text('บริษัท ABC จำกัด', 110, doc.y - 9)
  doc.font(sarabunLight)
  doc.text('สาขา :', 280, doc.y - 9)
  doc.text('สำนักงานใหญ่', 308, doc.y - 9)
  doc.moveDown(0.6)
  doc.font(sarabunMedium).text('เลขประจำตัวผู้เสียภาษี :', 22)
  doc.font(sarabunLight).text('0125556678900', 110, doc.y - 9)
  doc.moveDown(0.6)
  doc.font(sarabunMedium).text('ที่อยู่ :', 22)
  doc
    .font(sarabunLight)
    .text('เลขที่ x ถนน x แขวง/ตำบล บางนา เขต/อำเภอ บางนา จังหวัด กรุงเทพมหานคร 1060', 110, doc.y - 9)

  // Page detail
  doc.moveDown(2.1)
  doc.fontSize(8)
  doc.font(sarabunMedium).text('Page :', 0, doc.y, { width: 500, align: 'right' })
  doc.font(sarabunLight).text('1 of 1', 500, doc.y - 10, { align: 'center', width: 76 })
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

  doc.moveDown(0.5)

  doc.moveDown(0.5)

  range(1, 34).map((num) => {
    doc
      .moveDown(0.5)
      .font(sarabunLight)
      .fontSize(8)
      .text(`${num}`, 22, doc.y, { width: 32, align: 'center' })
      .text('1/8/2566', 54, doc.y - 10, { width: 64, align: 'center' })
      .text('MM1234567', 118, doc.y - 10, { width: 64, align: 'center' })
      .text(
        `ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'} ------- ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}`,
        182,
        doc.y - 10,
        { width: 260, align: 'left' },
      )
      .text('1,500.00', 442, doc.y - 10, { width: 64, align: 'right' })
      .text('1,500.00', 506, doc.y - 10, { width: 78, align: 'right' })
    const heig = doc.heightOfString(
      `ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'}`,
      { width: 260 },
    )
    console.log('dff: ', heig)
  })

  // doc.table(
  //   {
  //     headers: [
  //       { label: 'ลำดับ', property: 'no', renderer: null, width: 32, align: 'center' },
  //       { label: 'วันที่ใช้บริการ', property: 'bookingDate', renderer: null, width: 64, align: 'center' },
  //       { label: 'หมายเลขงาน', property: 'trackingNumber', renderer: null, width: 64, align: 'center' },
  //       { label: 'รายละเอียด', property: 'detail', renderer: null, width: 260, align: 'left' },
  //       { label: 'จำนวนเงิน', property: 'subtotal', renderer: null, width: 64, align: 'right' },
  //       { label: 'จำนวนเงินสุทธิ', property: 'total', renderer: null, width: 78, align: 'right' },
  //     ],
  //     datas: range(1, 34).map((num) => ({
  //       no: `${num}`,
  //       bookingDate: '1/8/2566',
  //       trackingNumber: 'MM1234567',
  //       detail: `ค่าขนส่ง${'รถกระบะตู้ทึบ'} ${'บางนา'} ไปยัง ${'ชลบุรี'}`,
  //       subtotal: '1,500.00',
  //       total: '1,500.00',
  //     })),
  //   },
  //   {
  //     hideHeader: true,
  //     divider: { horizontal: { disabled: true } },
  //     prepareRow: (_row, _indexColumn, _indexRow, _rectRow, _rectCell) => doc.font(sarabunLight).fontSize(8),
  //     padding: [8, 4, 4, 4, 4, 8],
  //     x: 22,
  //   },
  // )

  // Seperate line
  doc.lineCap('butt').lineWidth(1.5).moveTo(22, doc.y).lineTo(584, doc.y).stroke()

  // Total detail
  doc.moveDown(2)
  doc.fontSize(8)
  doc.font(sarabunMedium).text('รวมเป็นเงิน :', 0, doc.y, { width: 450, align: 'right' })
  doc.font(sarabunLight).text('175,406.00', 450, doc.y - 10, { align: 'right', width: 128 })
  doc.moveDown(1.6)
  doc.font(sarabunMedium).text('ภาษีหัก ณ ที่จ่าย 1% :', 0, doc.y - 10, { width: 450, align: 'right' })
  doc.font(sarabunLight).text('1,754.06', 450, doc.y - 10, { align: 'right', width: 128 })
  doc.moveDown(2.6)
  doc.fontSize(10)
  doc.font(sarabunMedium).text('รวมที่ต้องชำระทั้งสิ้น :', 0, doc.y - 12, { width: 450, align: 'right' })
  doc.font(sarabunSemiBold).text('173,651.96', 450, doc.y - 12, { align: 'right', width: 128 })
  doc
    .fontSize(7)
    .font(sarabunLight)
    .text('( หนึ่งแสนเจ็ดหมื่นสามพันหกร้อยห้าสิบเอ็ดบาทเก้าสิบสี่สตางค์ )', 0, doc.y + 4, {
      align: 'right',
      width: 578,
    })

  // Policy detail
  doc.moveDown(3.5)
  doc.fontSize(8)
  doc.font(sarabunMedium).text('เงื่อนไขการชำระเงิน:', 22)
  doc
    .font(sarabunLight)
    .text('ภายใน 7 วันปฏิทินนับจากวันที่ออกใบแจ้งหนี้ ในกรณีที่ชำระเงินไม่ตรงตามระยะเวลาที่กำหนด', 92, doc.y - 10)
  doc.moveDown(0.3)
  doc.text(
    'บริษัทฯจะคิดค่าธรรมเนียมอัตราร้อยละ 3.0 ต่อเดือนของยอดค้างชำระจนถึงวันที่ชำระเงินครบถ้วน ทั้งนี้ Movemate มีสิทธิ์ที่จะยกเลิกส่วนลดที่เกิดขึ้นก่อนทั้งหมด',
    22,
  )

  // Bank detail
  doc.moveDown(3.5)
  doc.text('ช่องทางชำระ :')
  doc.text('ธนาคาร กสิกรไทย', 80, doc.y - 10)
  doc.image(kbankPath, 220, doc.y - 20, { width: 100 })
  doc.moveDown(0.5)
  doc.text('ชื่อบัญชี :', 22)
  doc.text('บริษัท เทพพรชัย เอ็นเทอร์ไพรส์ จำกัด', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('เลขที่บัญชี :', 22)
  doc.text('117-1-54180-4', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('ประเภทบัญชี :', 22)
  doc.text('ออมทรัพย์', 80, doc.y - 10)
  doc.moveDown(0.5)
  doc.text('สาขา :', 22)
  doc.text('เซ็นทรัล บางนา', 80, doc.y - 10)

  // After transfer detail
  doc.moveDown(1)
  doc.fontSize(6).fillColor('#212B36')
  doc.text('เมื่อท่ำนได้ชำระแล้วกรุณาส่งหลักฐานการชำระ มาที่ acc@movemateth.com พร้อมอ้างอิงเลขที่ใบแจ้งหนี้', 22)
  doc.moveDown(1)
  doc.text('*หากต้องการแก้ไขใบแจ้งหนี้และใบเสร็จรับเงิน กรุณาติตต่อ acc@movemateth.com ภายใน 3 วันทำการ')
  doc.moveDown(1)
  doc.text(
    'หลังจากได้รับเอกสาร มิเช่นนั้นทำงบริษัทฯ จะถือว่ำเอกสำรดังกล่าวถูกต้อง ครบถ้วน สมบูรณ์ เป็นที่เรียบร้อยแล้ว',
  )

  const halfWidth = doc.page.width / 2

  // Signatures
  doc.moveDown(5)
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

  doc.end()

  await new Promise((resolve) => writeStream.on('finish', resolve))

  return filePath
}
