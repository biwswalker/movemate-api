import { GraphQLContext } from '@configs/graphQL.config'
import {
  markBillingAsPaid,
  markBillingAsRefunded,
  markBillingAsRejected,
  revertPaymentRejection,
} from '@controllers/billingPayment'
import {
  EAdjustmentNoteType,
  EBillingInfoStatus,
  EBillingState,
  EBillingStatus,
  ECreditDisplayStatus,
  EDisplayStatus,
  EReceiptType,
} from '@enums/billing'
import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import { EUserRole, EUserType } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { GetBillingInput, ProcessBillingRefundInput } from '@inputs/billingCycle.input'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import RetryTransactionMiddleware, { WithTransaction } from '@middlewares/RetryTransaction'
import FileModel from '@models/file.model'
import BillingModel, { Billing } from '@models/finance/billing.model'
import {
  BillingInfoPayload,
  BillingListPaginationPayload,
  BillingStatusPayload,
  TotalBillingRecordPayload,
} from '@payloads/billingCycle.payloads'
import {
  AGGREGATE_BILLING_STATUS_COUNT,
  BILLING_CYCLE_LIST,
  GET_BILLING_STATUS_BY_BILLING_NUMBER,
} from '@pipelines/billingCycle.pipeline'
import { reformPaginate } from '@utils/pagination.utils'
import { GraphQLError } from 'graphql'
import { get, head, includes, isEmpty, last, map, omit, reduce, sortBy, tail, toNumber, toString, uniq } from 'lodash'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import UserModel, { User } from '@models/user.model'
import { addDays, endOfMonth, format, parse, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import path from 'path'
import addEmailQueue from '@utils/email.utils'
import { generateReceipt } from 'reports/receipt'
import { ApprovalBillingPaymentInput } from '@inputs/billingPayment.input'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from '@models/transaction.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import { shipmentNotify } from '@controllers/shipmentNotification'
import { generateBillingReceipt } from '@controllers/billingReceipt'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import { CreateAdjustmentNoteInput } from '@inputs/billingAdjustmentNote.input'
import { createAdjustmentNote } from '@controllers/billingAdjustment'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import { Invoice } from '@models/finance/invoice.model'
import { updateCustomerCreditUsageBalance } from '@controllers/customer'
import { Quotation } from '@models/finance/quotation.model'
import PaymentModel from '@models/finance/payment.model'
import ReceiptModel, { Receipt } from '@models/finance/receipt.model'
import { generateMonthlySequenceNumber } from '@utils/string.utils'
import { generateAdvanceReceipt } from 'reports/advanceReceipt'
import { GraphQLJSONObject } from 'graphql-type-json'
import { generateCashReceipt } from 'reports/cashReceipt'
import RefundNoteModel from '@models/finance/refundNote.model'
import { generateRefundReceipt } from 'reports/refundReceipt'

@Resolver()
export default class BillingResolver {
  @Query(() => BillingListPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getBillingList(
    @Arg('data', { nullable: true }) data: GetBillingInput,
    @Args() paginate: PaginationArgs,
  ): Promise<BillingListPaginationPayload> {
    try {
      const { sort = undefined, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
      const aggregate = BillingModel.aggregate(BILLING_CYCLE_LIST(data, sort))
      const _billings = (await BillingModel.aggregatePaginate(aggregate, reformSorts)) as BillingListPaginationPayload
      if (!_billings) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return _billings
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => [TotalBillingRecordPayload])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getBillingStatusCount(
    @Arg('type', () => EPaymentMethod, { nullable: true }) type: EPaymentMethod,
    @Arg('customerId', { nullable: true }) customerId: string,
  ): Promise<TotalBillingRecordPayload[]> {
    // 1. เรียกใช้ Aggregation Pipeline
    const pipeline = AGGREGATE_BILLING_STATUS_COUNT(type, customerId)
    const results: { key: string; count: number }[] = await BillingModel.aggregate(pipeline)

    const statusEnum = type
      ? type === EPaymentMethod.CASH
        ? Object.values(EDisplayStatus)
        : Object.values(ECreditDisplayStatus)
      : uniq([...Object.values(ECreditDisplayStatus), ...Object.values(EDisplayStatus)])
    const statusLabels: { [key: string]: string } = {
      // Cash Labels
      AWAITING_VERIFICATION: 'รอตรวจสอบ',
      PAID: 'ชำระแล้ว',
      CANCELLED: 'ยกเลิกงาน',
      REFUNDED: 'คืนเงินแล้ว',
      BILLED: 'ออกใบเสร็จ',
      WHT_RECEIVED: 'ได้รับหัก ณ ที่จ่าย',
      // Credit Labels
      IN_CYCLE: 'อยู่ในรอบชำระ',
      OVERDUE: 'ค้างชำระ',
    }

    console.log('statusEnum:: ', statusEnum)
    // 3. สร้าง Map ของผลลัพธ์ที่ได้จาก Aggregation
    const resultMap = new Map(results.map((item) => [item.key, item.count]))

    // 4. สร้าง Array ผลลัพธ์สุดท้ายโดยอิงจาก Enum เพื่อให้มีครบทุกสถานะ
    const finalCounts = Object.values(omit(statusEnum, ['NONE'])).map((statusKey) => ({
      key: statusKey,
      label: statusLabels[statusKey] || statusKey,
      count: resultMap.get(statusKey) || 0, // ถ้าไม่มีในผลลัพธ์ ให้เป็น 0
    }))

    // 5. คำนวณยอด "ทั้งหมด"
    const totalCount = results.reduce((sum, item) => sum + item.count, 0)
    finalCounts.unshift({
      key: 'ALL',
      label: 'ทั้งหมด',
      count: totalCount,
    } as any)

    return finalCounts
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAllBillingIds(@Arg('data', { nullable: true }) data: GetBillingInput): Promise<string[]> {
    try {
      const billingCycles = await BillingModel.aggregate(BILLING_CYCLE_LIST(data))
      const ids = map(billingCycles, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => Billing)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async getBilling(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingNumber') billingNumber: string,
    @Arg('project', () => GraphQLJSONObject, { nullable: true }) project: object,
  ): Promise<Billing> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const _billing = await BillingModel.findOne(
        {
          billingNumber,
          ...(user_role === EUserRole.CUSTOMER ? { user: user_id } : {}),
        },
        !isEmpty(project) ? project : undefined,
      )
      if (!_billing) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return _billing
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async processBillingRefund(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') { imageEvidence, ...data }: ProcessBillingRefundInput,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id
    const imageEvidenceFile = imageEvidence ? new FileModel(imageEvidence) : undefined
    imageEvidence ? await imageEvidenceFile.save({ session }) : undefined
    await markBillingAsRefunded({ ...data, imageEvidenceId: imageEvidenceFile?._id }, adminId, session)

    await getAdminMenuNotificationCount(session)
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async confirmBillingDocumentPostalSent(
    @Ctx() ctx: GraphQLContext,
    @Arg('documentId') documentId: string,
    @Arg('trackingNumber') trackingNumber: string,
    @Arg('postalProvider') postalProvider: string,
  ): Promise<boolean> {
    const adminId = ctx.req.user_id
    try {
      await BillingDocumentModel.findByIdAndUpdate(documentId, {
        postalTime: new Date(),
        trackingNumber,
        provider: postalProvider,
        updatedBy: adminId,
      })
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async confirmReceiveWHTDocument(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingId') billingId: string,
    @Arg('receiptId') receiptId: string,
    @Arg('documentId') documentId: string,
    @Arg('documentNumber') documentNumber: string,
    @Arg('receiveDate', () => Date) receiveDate: Date,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id
    const _billing = await BillingModel.findById(billingId).session(session)
    await BillingDocumentModel.findByIdAndUpdate(
      documentId,
      {
        receivedWHTDocumentDate: receiveDate,
        documentNumber: documentNumber,
        updatedBy: adminId,
      },
      { session, new: true },
    )
    // Regenerate receipt
    const _receipt = await ReceiptModel.findById(receiptId).session(session)
    const { document, fileName, filePath } = await generateReceipt(_billing, _receipt, session)

    const _customerId = get(_billing, 'user._id', '')
    const _customer = await UserModel.findById(_customerId).session(session)
    const _isCashReceipt = _billing.paymentMethod === EPaymentMethod.CASH
    if (_customer) {
      const shipment = last(_billing.shipments) as Shipment | undefined
      const financialEmails = get(_customer, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = uniq([_customer.email, ...financialEmails])
      const pickup = head(shipment.destinations)?.name || ''
      const dropoffs = reduce(
        tail(shipment?.destinations),
        (prev, curr) => {
          if (curr.name) {
            return prev ? `${prev}, ${curr.name}` : curr.name
          }
          return prev
        },
        '',
      )
      const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${shipment.trackingNumber}`
      const movemate_link = `https://www.movematethailand.com`
      const contact_number = '02-xxx-xxxx'
      const financial_email = 'acc@movematethailand.com'
      const customer_type = 'บริษัท/องค์กร'

      if (_isCashReceipt) {
        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
          to: emails,
          subject: `ใบเสร็จรับเงิน Movemate Thailand | Shipment No. ${shipment.trackingNumber}`,
          template: 'cash_receipt',
          context: {
            tracking_number: shipment.trackingNumber,
            fullname: _customer.fullname,
            phone_number: _customer.contactNumber,
            email: _customer.email,
            customer_type,
            pickup,
            dropoffs,
            tracking_link,
            contact_number,
            movemate_link,
          },
          attachments: [{ filename: fileName, path: filePath }],
        })
      } else {
        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
          to: emails,
          subject: `ใบเสร็จรับเงิน Movemate Thailand`,
          template: 'notify_receipt',
          context: {
            business_name: _customer.fullname,
            business_contact_number: _customer.contactNumber,
            business_email: _customer.email,
            customer_type,
            financial_email,
            contact_number,
            movemate_link,
          },
          attachments: [{ filename: fileName, path: filePath }],
        })
      }
      console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Receipt has sent for ${emails.join(', ')}`)
      await BillingDocumentModel.findByIdAndUpdate(document._id, { emailTime: new Date().toISOString() }, { session })
    }

    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async resentBillingDocumentToEmail(
    @Arg('type') type: 'invoice' | 'receipt',
    @Arg('billingId') billingId: string,
    @Arg('documentId') documentId: string,
  ): Promise<boolean> {
    try {
      const _billing = await BillingModel.findById(billingId).lean()
      const _document = await BillingDocumentModel.findById(documentId)
      const _customer = await UserModel.findById(_billing.user)
      if (_customer && _document) {
        const financialEmails = get(_customer, 'businessDetail.creditPayment.financialContactEmails', [])
        const emails = uniq([_customer.email, ...financialEmails])
        if (type === 'invoice') {
          const month_text = format(new Date(), 'MMMM', { locale: th })
          const year_number = toNumber(format(new Date(), 'yyyy', { locale: th }))
          const year_text = toString(year_number + 543)
          const filePath = path.join(__dirname, '..', '..', 'generated/invoice', _document.filename)

          await addEmailQueue({
            from: process.env.MAILGUN_SMTP_EMAIL,
            to: emails,
            subject: `[Auto Email] Movemate Thailand ใบแจ้งหนี้ค่าบริการ ${_billing.billingNumber}`,
            template: 'notify_invoice',
            context: {
              business_name: _customer.fullname,
              month_text,
              year_text,
              financial_email: 'acc@movematethailand.com',
              contact_number: '02-xxx-xxxx',
              movemate_link: `https://www.movematethailand.com`,
            },
            attachments: [{ filename: path.basename(filePath), path: filePath }],
          })
          await BillingDocumentModel.findByIdAndUpdate(documentId, { emailTime: new Date() })
        } else if (type === 'receipt') {
          const filePath = path.join(__dirname, '..', '..', 'generated/receipt', _document.filename)
          const businessContactNumber = get(_customer, 'businessDetail.contactNumber', '')

          await addEmailQueue({
            from: process.env.MAILGUN_SMTP_EMAIL,
            to: emails,
            subject: `ใบเสร็จรับเงิน Movemate Thailand`,
            template: 'notify_receipt',
            context: {
              business_name: _customer.fullname,
              business_contact_number: businessContactNumber,
              business_email: _customer.email,
              customer_type: _customer.userType === EUserType.INDIVIDUAL ? 'ส่วนบุคคล' : 'บริษัท/องค์กร',
              financial_email: 'acc@movematethailand.com',
              contact_number: '02-xxx-xxxx',
              movemate_link: `https://www.movematethailand.com`,
            },
            attachments: [{ filename: path.basename(filePath), path: filePath }],
          })
          await BillingDocumentModel.findByIdAndUpdate(documentId, { emailTime: new Date() })
        }
      }
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async isNearbyDuedate(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    const customerId = ctx.req.user_id
    try {
      const currentday = new Date()
      const today = currentday.setHours(0, 0, 0, 0)
      const threeDaysLater = addDays(currentday, 3).setHours(23, 59, 59, 999)
      const billingCycleModel = await BillingModel.find({
        user: customerId,
        state: EBillingState.CURRENT,
        status: EBillingStatus.PENDING,
        paymentDueDate: {
          $gte: today, // paymentDueDate หลังจากหรือเท่ากับวันนี้
          $lte: threeDaysLater, // และก่อนหรือเท่ากับในอีก 3 วันข้างหน้า
        },
      }).lean()
      return billingCycleModel.length > 0
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => [Billing])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async getMonthBilling(
    @Ctx() ctx: GraphQLContext,
    @Arg('monthofyear') monthofyear: string,
    @Args() loadmore: LoadmoreArgs,
  ) {
    const userId = ctx.req.user_id
    try {
      if (userId) {
        const month = parse(monthofyear, 'MM/yyyy', new Date())
        const startDate = startOfMonth(month)
        const endDate = endOfMonth(month)
        const billings = await BillingModel.find({
          user: userId,
          paymentMethod: EPaymentMethod.CREDIT,
          issueDate: { $gt: startDate.setHours(0, 0, 0, 0), $lt: endDate.setHours(23, 59, 59, 999) },
        })
          .sort({ issueDate: -1, createdAt: -1 })
          .skip(loadmore.skip)
          .limit(loadmore.limit)
          .exec()
        return billings
      }
      return []
    } catch (error) {
      return []
    }
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async getTotalMonthBilling(@Ctx() ctx: GraphQLContext, @Arg('monthofyear') monthofyear: string): Promise<number> {
    const userId = ctx.req.user_id
    if (userId) {
      const month = parse(monthofyear, 'MM/yyyy', new Date())
      const startDate = startOfMonth(month)
      const endDate = endOfMonth(month)
      const total = await BillingModel.countDocuments({
        user: userId,
        paymentMethod: EPaymentMethod.CREDIT,
        issueDate: { $gt: startDate.setHours(0, 0, 0, 0), $lt: endDate.setHours(23, 59, 59, 999) },
      })
      return total
    }
    return 0
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async regenerateReceipt(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingId') billingId: string,
    @Arg('receiptId') receiptId: string,
  ): Promise<boolean> {
    const session = ctx.session
    const _billing = await BillingModel.findById(billingId).session(session)
    const _receipt = await ReceiptModel.findById(receiptId).session(session)
    if (_billing.paymentMethod === EPaymentMethod.CASH) {
      if (_receipt.receiptType === EReceiptType.ADVANCE) {
        await generateAdvanceReceipt(_billing, _receipt, session)
      } else {
        await generateCashReceipt(_billing, _receipt, session)
      }
    } else {
      await generateReceipt(_billing, _receipt, session)
    }
    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async regenerateRefundReceipt(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingId') billingId: string,
    @Arg('refundId') refundId: string,
  ): Promise<boolean> {
    const session = ctx.session
    const _billing = await BillingModel.findById(billingId).session(session)
    const _refund = await RefundNoteModel.findById(refundId).session(session)
    await generateRefundReceipt(_billing, _refund, session)
    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async approvalBillingPayment(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: ApprovalBillingPaymentInput,
  ): Promise<boolean> {
    const adminId = ctx.req.user_id
    const session = ctx.session

    if (data.result === 'approve') {
      const imageEvidenceFile = data.imageEvidence ? new FileModel(data.imageEvidence) : null
      imageEvidenceFile && (await imageEvidenceFile.save({ session }))

      const paydate = format(data.paymentDate, 'dd/MM/yyyy')
      const paytime = format(data.paymentTime, 'HH:mm')
      const paymentDate = parse(`${paydate} ${paytime}`, 'dd/MM/yyyy HH:mm', new Date())

      const _billing = await markBillingAsPaid(
        {
          billingId: data.billingId,
          paymentId: data.paymentId,
          ...(imageEvidenceFile ? { imageEvidenceId: imageEvidenceFile._id, paymentDate: paymentDate } : {}),
        },
        adminId,
        session,
      )

      if (_billing.paymentMethod === EPaymentMethod.CASH) {
        const _shipment = await ShipmentModel.findOne({ trackingNumber: _billing.billingNumber })
          .session(session)
          .lean()
        if (_shipment.status === EShipmentStatus.DELIVERED) {
          /**
           * Handle If shipment complete
           * CASH: Payment genrate new Receipt
           */
          const lastReceipt = last(sortBy(_billing.receipts, 'createdAt')) as Receipt
          const documentId = await generateBillingReceipt(_billing._id, true, session)
          await ReceiptModel.findByIdAndUpdate(lastReceipt._id, { document: documentId }, { session })
        } else if (_shipment.status === EShipmentStatus.IDLE) {
          // 1. สร้าง "ใบรับเงินล่วงหน้า" เสมอ
          const _advanceReceiptNumber = await generateMonthlySequenceNumber('advancereceipt') // แนะนำให้ใช้ sequence แยก
          const _advanceReceipt = new ReceiptModel({
            receiptNumber: _advanceReceiptNumber,
            receiptType: EReceiptType.ADVANCE, // <-- ระบุประเภท
            receiptDate: new Date(paymentDate), // <-- ใช้วันที่ได้รับเงินจริง
            total: _billing.amount.total,
            subTotal: _billing.amount.subTotal,
            tax: _billing.amount.tax, //
            updatedBy: adminId,
          })

          // 2. (Optional) สร้าง PDF ใบรับเงินล่วงหน้าเก็บไว้
          const { document } = await generateAdvanceReceipt(_billing, _advanceReceipt, session)
          _advanceReceipt.document = document._id
          await _advanceReceipt.save({ session })

          // --- อัปเดต Billing ---
          await BillingModel.findByIdAndUpdate(
            _billing._id,
            {
              status: EBillingStatus.COMPLETE,
              state: EBillingState.CURRENT,
              updatedBy: adminId,
              // เพิ่มใบเสร็จที่ถูกต้องลงไป
              $push: { receipts: _advanceReceipt._id },
            },
            { session, new: true },
          )
        }
      }

      // For Movemate transaction
      const { subTotal, tax, total } = _billing.amount
      const movemateTransaction = new TransactionModel({
        amountBeforeTax: subTotal,
        amountTax: tax,
        amount: total,
        ownerId: MOVEMATE_OWNER_ID,
        ownerType: ETransactionOwner.MOVEMATE,
        description: `ยืนยันการชำระเงินหมายเลข ${_billing.billingNumber}`,
        refId: _billing._id,
        refType: ERefType.BILLING,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await movemateTransaction.save({ session })

      if (_billing.paymentMethod === EPaymentMethod.CASH) {
        const _shipment = head(_billing.shipments) as Shipment
        if (_shipment) {
          const currentShipmentState = await ShipmentModel.findById(_shipment._id).session(session).lean()
          if (currentShipmentState && currentShipmentState.status === EShipmentStatus.IDLE) {
            await ShipmentModel.findByIdAndUpdate(
              _shipment._id,
              {
                driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
                adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
                ...(data.newBookingDateTime ? { bookingDateTime: data.newBookingDateTime } : {}),
              },
              { session },
            )
            // End Session transaction
            await session.commitTransaction()
            console.log('[Start] shipmentNotify process')
            await shipmentNotify(_shipment._id)
            console.log('[End] shipmentNotify process')
          } else {
            console.log(
              `Skipping shipment status update for ${_shipment.trackingNumber}: Not in initial IDLE/PENDING state.`,
            )
          }
        }
      }

      // Update count admin
      console.log('[Pre Endding] approvalBillingPayment')
      await getAdminMenuNotificationCount()
      console.log('[Endding] approvalBillingPayment')
      return true
    } else if (data.result === 'reject') {
      await markBillingAsRejected(
        { billingId: data.billingId, paymentId: data.paymentId, reason: data.reason },
        adminId,
        session,
      )

      // Update count admin
      await getAdminMenuNotificationCount(session)
      return true
    }

    // Update count admin
    await getAdminMenuNotificationCount(session)
    return false
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async createBillingAdjustmentNote(
    @Ctx() ctx: GraphQLContext,
    @Arg('data') data: CreateAdjustmentNoteInput,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id

    const { adjustmentNote, fileName, filePath } = await createAdjustmentNote(data, adminId, session)
    // const _adjustmentNote = await BillingAdjustmentNoteModel.findById(adjustmentNote._id).session(session)
    const _billingPre = adjustmentNote?.billing
    if (!_billingPre) {
      console.error('No billing found for adjustment note')
      return
    }
    const _billing = await BillingModel.findById(_billingPre).session(session)
    const _user = _billing?.user as User | undefined
    if (_user) {
      const _invoice = _billing.invoice as Invoice | undefined
      const typeText = adjustmentNote.adjustmentType === EAdjustmentNoteType.CREDIT_NOTE ? 'ใบเพิ่มหนี้' : 'ใบลดหนี้'

      // Update user credit usage
      const amountToAdjustCredit =
        adjustmentNote.adjustmentType === EAdjustmentNoteType.CREDIT_NOTE
          ? -adjustmentNote.adjustmentSubTotal // ใบลดหนี้ (Credit Note) -> ลดหนี้ (ใช้ค่าลบ)
          : adjustmentNote.adjustmentSubTotal // ใบเพิ่มหนี้ (Debit Note) -> เพิ่มหนี้ (ใช้ค่าบวก)
      await updateCustomerCreditUsageBalance(_user._id.toString(), amountToAdjustCredit, session)

      if (_invoice) {
        await NotificationModel.sendNotification(
          {
            userId: _user._id,
            varient: ENotificationVarient.INFO,
            title: 'มีการสร้างใบปรับปรุงหนี้',
            message: [
              `สร้าง ${typeText} (${adjustmentNote.adjustmentNumber}) สำหรับใบแจ้งหนี้หมายเลข: ${_invoice.invoiceNumber} สำเร็จ`,
            ],
            infoLink: `/main/billing?billing_number=${_billing.billingNumber}`,
            infoText: 'คลิกเพื่อดูรายละเอียด',
          },
          session,
        )
      }

      const _document = adjustmentNote.document as BillingDocument | undefined

      if (!_document) {
        console.error('No document found for adjustment note')
        return
      }

      const subject = `[Auto Email] Movemate Thailand เอกสาร${typeText} เลขที่ ${adjustmentNote.adjustmentNumber}`
      const financialEmails = get(_user, 'businessDetail.creditPayment.financialContactEmails', [])
      const emails = uniq([_user.email, ...financialEmails]).filter(Boolean)
      if (emails.length === 0) {
        console.error(`No email address for customer ${_user.userNumber} to send adjustment note.`)
        return
      }

      // 4. เพิ่มเข้าคิวส่งอีเมล
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: emails,
        subject: subject,
        template: 'notify_adjustment_note', // ชื่อ template ใหม่
        context: {
          customer_name: _user.fullname,
          document_title: typeText,
          adjustment_number: adjustmentNote.adjustmentNumber,
          contact_number: '02-xxx-xxxx', // ควรมาจาก config
          movemate_link: 'https://www.movematethailand.com',
        },
        attachments: [
          {
            filename: fileName,
            path: filePath,
          },
        ],
      })
    }
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async revertRejectedPayment(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingId') billingId: string,
    @Arg('paymentId') paymentId: string,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id

    // เราจะเรียกใช้ฟังก์ชันหลักจาก Controller ที่จะสร้างในขั้นตอนถัดไป
    await revertPaymentRejection(billingId, paymentId, adminId, session)

    // ส่ง Notification แจ้งเตือน Admin ว่าสถานะได้ถูกย้อนกลับแล้ว
    await getAdminMenuNotificationCount()

    return true
  }

  @Query(() => BillingInfoPayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async getBillingInfoByShipmentId(@Arg('shipmentId') shipmentId: string): Promise<BillingInfoPayload> {
    const shipment = await ShipmentModel.findById(shipmentId).lean()

    if (!shipment) {
      return {
        paymentMethod: EPaymentMethod.CASH,
        status: EBillingInfoStatus.NO_RECORD,
        message: 'ไม่พบข้อมูลงานขนส่งดังกล่าว',
      }
    }

    const billing = await BillingModel.findOne({ shipments: { $in: shipmentId } }).lean()
    if (billing) {
      // Billing record found, return it
      return {
        paymentMethod: shipment.paymentMethod,
        billingNumber: billing.billingNumber,
        billingState: billing.state,
        billingStatus: billing.status,
        status: EBillingInfoStatus.AVAILABLE,
        message: 'ออกใบแจ้งหนี้แล้ว',
      }
    } else {
      // No direct billing record found, determine the reason
      const latestQuotation = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined

      if (!latestQuotation) {
        // This case should ideally not happen if a shipment exists and was priced
        return {
          paymentMethod: shipment.paymentMethod,
          status: EBillingInfoStatus.NO_RECORD,
          message: 'ไม่พบข้อมูลราคาสำหรับการขนส่งนี้',
        }
      }

      const isCreditPayment = shipment.paymentMethod === EPaymentMethod.CREDIT

      // Handle cases based on shipment status and payment method
      if (shipment.status === EShipmentStatus.CANCELLED) {
        // If shipment is cancelled/refunded, but no billing record linked (might be a very old entry or a data inconsistency)
        return {
          paymentMethod: shipment.paymentMethod,
          status: EBillingInfoStatus.NO_RECORD, // Or a more specific status like CANCELLED_NO_BILLING
          message: `งานขนส่งถูกยกเลิก ไม่มียอดต้องชำระ`,
        }
      } else if (isCreditPayment) {
        // For credit payments, billing is cyclical. If no billing found, it's likely not yet generated.
        return {
          paymentMethod: shipment.paymentMethod,
          status: EBillingInfoStatus.NOT_YET_BILLED,
          message: 'รอวางบิล',
          // message: 'ใบแจ้งหนี้สำหรับการขนส่งนี้ยังไม่ถูกสร้าง (อยู่ระหว่างรอบบิล)',
        }
      } else {
        // For cash payments, billing should be immediate. If not found, it's an unexpected error or pending verification.
        // Check if there's any pending payment record for this quotation
        const payment = await PaymentModel.findOne({ quotations: latestQuotation._id }).lean()
        if (payment && includes([EPaymentStatus.PENDING, EPaymentStatus.VERIFY], payment.status)) {
          return {
            paymentMethod: shipment.paymentMethod,
            status: EBillingInfoStatus.NOT_YET_BILLED, // Reusing NOT_YET_BILLED for "pending processing"
            message: 'การชำระเงินอยู่ระหว่างการตรวจสอบและยืนยัน',
          }
        } else {
          return {
            paymentMethod: shipment.paymentMethod,
            status: EBillingInfoStatus.NO_RECORD,
            message: 'ไม่พบใบแจ้งหนี้/ใบเสร็จรับเงินสำหรับงานขนส่งนี้ อาจเกิดข้อผิดพลาดหรือข้อมูลไม่ครบถ้วน',
          }
        }
      }
    }
  }

  @Query(() => BillingStatusPayload, { description: 'ดึงสถานะล่าสุดของ Billing จาก ID (รองรับทั้ง Cash และ Credit)' })
  @UseMiddleware(AuthGuard([EUserRole.ADMIN])) // หรือ Role อื่นๆ ที่เกี่ยวข้อง
  async getBillingStatusById(@Arg('billingNumber') billingNumber: string): Promise<BillingStatusPayload> {
    try {
      const pipeline = GET_BILLING_STATUS_BY_BILLING_NUMBER(billingNumber)
      const result = await BillingModel.aggregate(pipeline)

      if (!result || result.length === 0) {
        throw new GraphQLError('ไม่พบข้อมูล Billing ID ที่ระบุ')
      }

      return result[0]
    } catch (error) {
      console.error(`Error in getBillingStatusById for ID ${billingNumber}:`, error)
      // ส่ง error เดิมออกไปเพื่อให้ client ทราบ
      if (error instanceof GraphQLError) {
        throw error
      }
      throw new Error('ไม่สามารถเรียกข้อมูลสถานะ Billing ได้')
    }
  }
}
