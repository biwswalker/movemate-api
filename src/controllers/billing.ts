import { EBillingState, EBillingStatus } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EShipmentStatus } from '@enums/shipments'
import { EUserRole, EUserStatus, EUserType } from '@enums/users'
import BusinessCustomerCreditPaymentModel, {
  BilledMonth,
  BusinessCustomerCreditPayment,
} from '@models/customerBusinessCreditPayment.model'
import BillingModel, { Billing } from '@models/finance/billing.model'
import InvoiceModel from '@models/finance/invoice.model'
import { PaymentAmounts } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel, { User } from '@models/user.model'
import { GET_CUSTOMER_WITH_TODAY_BILLED_DATE } from '@pipelines/user.pipeline'
import addEmailQueue from '@utils/email.utils'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { addDays, addMonths, differenceInDays, format } from 'date-fns'
import { th } from 'date-fns/locale'
import lodash, { get, includes, isEmpty, last, reduce, sortBy, sum, toNumber, toString, uniq } from 'lodash'
import { ClientSession, Types } from 'mongoose'
import { generateInvoice } from 'reports/invoice'
import path from 'path'
import BillingDocumentModel from '@models/finance/documents.model'

Aigle.mixin(lodash, {})

export async function createBillingCreditUser(customerId: string, session?: ClientSession) {
  const _customer = await UserModel.findOne({
    _id: new Types.ObjectId(customerId),
    userType: EUserType.BUSINESS,
    userRole: EUserRole.CUSTOMER,
  }).session(session)

  if (_customer) {
    const creditPaymentDetail = get(_customer, 'businessDetail.creditPayment') as
      | BusinessCustomerCreditPayment
      | undefined

    if (creditPaymentDetail) {
      const today = new Date()
      /**
       * Get billing date / due date
       */
      const prevMonth = addMonths(today, -1)
      const prevMonthText = format(prevMonth, 'MMM').toLowerCase() as keyof BilledMonth
      const monthText = format(today, 'MMM').toLowerCase() as keyof BilledMonth
      const prevBillingDate = creditPaymentDetail.billedDate[prevMonthText] || 1
      const billingDate = creditPaymentDetail.billedDate[monthText] || 1
      const duedateDate = creditPaymentDetail.billedRound[monthText] || 15
      /**
       * Convert Billing day number to Date and get Billing start/end date
       * Period: (Previous Month - Previous Day)
       */
      const prevBilledDate = prevMonth.setDate(prevBillingDate)
      const billedDate = new Date().setDate(billingDate)
      const previousMonth = addMonths(prevBilledDate, 0).setHours(0, 0, 0, 0) // Previous Month
      const previousDay = addDays(billedDate, -1).setHours(23, 59, 59, 999) // Previous Day

      /**
       * Get Complete Shipment
       * Complete period: (Previous Month - Previous Day)
       */
      const _shipments = await ShipmentModel.find({
        customer: customerId,
        status: EShipmentStatus.DELIVERED,
        paymentMethod: EPaymentMethod.CREDIT,
        deliveredDate: { $gte: previousMonth, $lte: previousDay },
      })

      if (!_shipments || isEmpty(_shipments)) {
        return
      }
      /**
       * Calculate all shipment prices
       */
      let quotationIds = []
      const prices = reduce<Shipment, PaymentAmounts>(
        _shipments,
        (prev, curr) => {
          const latestQuotation = last(sortBy(curr.quotations, ['createdAt'])) as Quotation | undefined
          if (latestQuotation) {
            quotationIds.push(latestQuotation._id)
            const { subTotal: _subTotal, tax: _tax, total: _total } = latestQuotation.price
            const subTotal = sum([prev.subTotal, _subTotal])
            const tax = sum([prev.tax, _tax])
            const total = sum([prev.total, _total])
            return { subTotal, tax, total }
          }
          return prev
        },
        { tax: 0, subTotal: 0, total: 0 },
      )
      /**
       * Create Invoice data
       */
      const _monthyear = format(new Date(), 'yyMM')
      const _invoiceNumber = await generateTrackingNumber(`IV${_monthyear}`, 'invoice', 3)
      const _invoice = new InvoiceModel({
        invoiceNumber: _invoiceNumber,
        invoiceDate: billedDate,
        name: _customer.fullname,
        address: creditPaymentDetail.financialAddress,
        province: creditPaymentDetail.financialProvince,
        district: creditPaymentDetail.financialDistrict,
        subDistrict: creditPaymentDetail.financialSubDistrict,
        postcode: creditPaymentDetail.financialPostcode,
        contactNumber: creditPaymentDetail.financialContactNumber,
        subTotal: prices.subTotal,
        total: prices.total,
        tax: prices.tax,
        document: null,
      })
      await _invoice.save({ session })
      /**
       * Create Payment
       */
      const generateMonth = format(new Date(), 'yyMM')
      const _paymentNumber = await generateTrackingNumber(`PAYCRE${generateMonth}`, 'payment', 3)
      const _payment = new PaymentModel({
        quotations: quotationIds,
        paymentMethod: EPaymentMethod.CREDIT,
        paymentNumber: _paymentNumber,
        status: EPaymentStatus.PENDING,
        type: EPaymentType.PAY,
        subTotal: prices.subTotal,
        total: prices.total,
        tax: prices.tax,
      })
      await _payment.save({ session })
      /**
       * Convert Duedate day number to Date
       */
      const paymentDueDate = new Date(new Date().setDate(duedateDate)).setHours(23, 59, 59, 999)
      /**
       * Create Billing for Credit user
       */
      const _billing = new BillingModel({
        billingNumber: _invoiceNumber,
        status: EBillingStatus.PENDING,
        state: EBillingState.CURRENT,
        paymentMethod: EPaymentMethod.CREDIT,
        user: customerId,
        shipments: _shipments,
        payments: [_payment],
        issueDate: billedDate,
        billingStartDate: previousMonth,
        billingEndDate: previousDay,
        paymentDueDate: paymentDueDate,
        invoice: _invoice,
      })
      await _billing.save({ session })
      /**
       * Update new balance for customer
       */
      const customerCreditOutstandingBalance = creditPaymentDetail.creditOutstandingBalance || 0
      const balance = sum([customerCreditOutstandingBalance, prices.total])
      await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(
        creditPaymentDetail._id,
        { creditOutstandingBalance: balance },
        { session },
      )
    }
  }
}

export async function checkNearbyDuedateBilling(before: number = 1): Promise<Billing[]> {
  const today = new Date()
  const beforeDay = addDays(today, before)
  const startOfBeforeDay = beforeDay.setHours(0, 0, 0, 0)
  const endOfBeforeDay = beforeDay.setHours(23, 59, 59, 999)
  const billing = await BillingModel.find({
    billingStatus: EBillingStatus.PENDING,
    paymentDueDate: {
      $gte: startOfBeforeDay, // paymentDueDate หลังจากหรือเท่ากับวันนี้
      $lte: endOfBeforeDay, // และก่อนหรือเท่ากับในอีก 1 วันข้างหน้า
    },
  }).lean()

  return billing
}

export async function notifyNearbyDuedate(beforeDuedateDay: number) {
  const getMessage = (day) => {
    switch (day) {
      case 0:
        return { title: 'ครบกำหนดชำระ', message: 'ครบกำหนดชำระแล้ว กรุณาเตรียมการชำระเงิน' }
      case 1:
        return { title: 'ใกล้ครบกำหนดชำระ', message: 'พรุ่งนี้เป็นวันครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน' }
      case 2:
        return { title: 'ใกล้ครบกำหนดชำระ', message: 'อีก 2 วันจะครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน' }
      case 3:
        return { title: 'ใกล้ครบกำหนดชำระ', message: 'อีก 3 วันจะครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน' }
      default:
        return { title: 'ใกล้ครบกำหนดชำระ', message: 'ใกล้จะครบกำหนดชำระค่าบริการ กรุณาเตรียมการชำระเงิน' }
    }
  }
  const billings = await checkNearbyDuedateBilling(beforeDuedateDay)
  const { title, message } = getMessage(beforeDuedateDay)
  await Aigle.forEach(billings, async (billing) => {
    await NotificationModel.sendNotification({
      userId: billing.user as string,
      varient: ENotificationVarient.WRANING,
      title,
      message: [message],
      infoLink: `/main/billing?billing_number=${billing.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

export async function notifyOverdueBilling() {
  const overdueBilling = await BillingModel.find({
    status: EBillingStatus.PENDING,
    state: EBillingState.OVERDUE,
  }).lean()

  await Aigle.forEach(overdueBilling, async (billing) => {
    const today = new Date()
    const overdate = differenceInDays(today.setHours(0, 0, 0, 0), new Date(billing.paymentDueDate).setHours(0, 0, 0, 0))
    await NotificationModel.sendNotification({
      userId: billing.user as string,
      varient: ENotificationVarient.ERROR,
      title: `บัญชีของท่านค้างชำระ`,
      message: [`ขณะนี้บัญชีของท่านค้างชำระ และเลยกำหนดชำระมา ${overdate} วัน`],
      infoLink: `/main/billing?billing_number=${billing.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

/**
 * Sent invoice notification to customer
 */
export async function notifyIssueBillingToCustomer() {
  const today = new Date()
  const startRange = today.setHours(0, 0, 0, 0)
  const endRange = today.setHours(23, 59, 59, 999)

  const _billings = await BillingModel.find({
    status: EBillingStatus.PENDING,
    state: EBillingState.CURRENT,
    createdAt: { $gte: startRange, $lt: endRange },
    paymentMethod: EPaymentMethod.CREDIT,
  })

  await Aigle.forEach(_billings, async (billing) => {
    await NotificationModel.sendNotification({
      userId: billing.user as string,
      varient: ENotificationVarient.MASTER,
      title: 'ออกใบแจ้งหนี้แล้ว',
      message: [`ระบบได้ออกใบแจ้งหนี้หมายเลข ${billing.billingNumber} แล้ว`],
      infoLink: `/main/billing?billing_number=${billing.billingNumber}`,
      infoText: 'คลิกเพื่อดูรายละเอียด',
    })
  })
}

/**
 * Sent invoice email to customer
 */
export async function emailIssueBillingToCustomer(session?: ClientSession) {
  const today = new Date()
  const startRange = today.setHours(0, 0, 0, 0)
  const endRange = today.setHours(23, 59, 59, 999)

  const _billings = await BillingModel.find({
    status: EBillingStatus.PENDING,
    state: EBillingState.CURRENT,
    createdAt: { $gte: startRange, $lt: endRange },
    paymentMethod: EPaymentMethod.CREDIT,
  }).session(session)

  await Aigle.forEach(_billings, async (billing) => {
    const customer = await UserModel.findById(billing.user).session(session)
    if (customer) {
      const financialEmails = get(customer, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = uniq([customer.email, ...financialEmails]).filter((email) => !isEmpty(email))
      const month_text = format(new Date(), 'MMMM', { locale: th })
      const year_number = toNumber(format(new Date(), 'yyyy', { locale: th }))
      const year_text = toString(year_number + 543)
      const invoice = await generateInvoice(billing, undefined, session)
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: emails,
        subject: `[Auto Email] Movemate Thailand ใบแจ้งหนี้ค่าบริการ ${billing.billingNumber}`,
        template: 'notify_invoice',
        context: {
          business_name: customer.fullname,
          month_text,
          year_text,
          financial_email: 'acc@movematethailand.com',
          contact_number: '02-xxx-xxxx',
          movemate_link: `https://www.movematethailand.com`,
        },
        attachments: [{ filename: path.basename(invoice.filePath), path: invoice.filePath }],
      })
      const documentId = invoice?.document?._id
      await InvoiceModel.findByIdAndUpdate(billing.invoice, { document: documentId })
      await BillingDocumentModel.findByIdAndUpdate(documentId, { emailTime: new Date() }, { session })
      console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
    }
  })
}

export async function issueCreditBilling() {
  const customers = await UserModel.aggregate(GET_CUSTOMER_WITH_TODAY_BILLED_DATE())
  if (customers && !isEmpty(customers)) {
    await Aigle.forEach(customers as User[], async (customer) => {
      if (customer._id) {
        await createBillingCreditUser(customer._id)
      }
    })
  }
}

export async function checkBillingStatus() {
  const today = new Date()
  /**
   * OVERDUE CHECK
   */
  const _overdueBillings = await BillingModel.find({
    status: EBillingStatus.PENDING,
    state: EBillingState.CURRENT,
    paymentDueDate: { $lt: today.setHours(0, 0, 0, 0) },
  }).lean()

  await Aigle.forEach(_overdueBillings, async (billing) => {
    await BillingModel.findByIdAndUpdate(billing._id, { state: EBillingState.OVERDUE })
    const customer = await UserModel.findById(billing.user)
    if (customer) {
      if (!includes([EUserStatus.INACTIVE, EUserStatus.BANNED], customer.status)) {
        await customer.updateOne({ status: EUserStatus.INACTIVE })
      }
    }
  })

  /**
   * SUSPENDED CHECK
   */
  const _suspendedBillings = await BillingModel.find({
    status: EBillingStatus.PENDING,
    state: EBillingState.OVERDUE,
    paymentDueDate: { $lt: addDays(today, -16).setHours(0, 0, 0, 0) },
  })

  let _bannedCustomer = []
  await Aigle.forEach(_suspendedBillings, async (suspendedBill) => {
    const customer = await UserModel.findById(suspendedBill.user)
    if (customer) {
      if (customer.status !== EUserStatus.BANNED) {
        await NotificationModel.sendNotification({
          userId: customer._id,
          varient: ENotificationVarient.ERROR,
          title: `บัญชีของท่านถูกระงับใช้งาน`,
          message: [`ขณะนี้บัญชีของท่านถูกระงับการใช้งาน เนื่องจากมียอดค้างชำระ กรุณาติดต่อเจ้าหน้าที่`],
          infoLink: `/main/billing?billing_number=${suspendedBill.billingNumber}`,
          infoText: 'คลิกเพื่อดูรายละเอียด',
        })
        await customer.updateOne({ status: EUserStatus.BANNED })
        _bannedCustomer = [..._bannedCustomer, customer._id]
      }
    }
  })

  // Notify to admin
  const bannedCustomerUniq = uniq(_bannedCustomer)
  if (!isEmpty(bannedCustomerUniq)) {
    const admins = await UserModel.find({ userRole: EUserRole.ADMIN, status: EUserStatus.ACTIVE })
    await Aigle.forEach(admins, async (admin) => {
      await NotificationModel.sendNotification({
        userId: admin._id,
        varient: ENotificationVarient.WRANING,
        title: `พบบัญชีค้างชำระ`,
        message: [`พบบัญชีค้างชำระ และถูกระงับใช้งานจำนวน ${bannedCustomerUniq.length} บัญชี`],
        infoLink: `/management/customer/business`,
        infoText: 'คลิกเพื่อดูรายละเอียด',
      })
    })
  }
}
