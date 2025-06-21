import { GraphQLContext } from '@configs/graphQL.config'
import { markBillingAsPaid, markBillingAsRefunded, markBillingAsRejected } from '@controllers/billingPayment'
import { EBillingCriteriaStatus, EBillingState, EBillingStatus } from '@enums/billing'
import { EPaymentMethod } from '@enums/payments'
import { EUserRole, EUserType } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { GetBillingInput, ProcessBillingRefundInput } from '@inputs/billingCycle.input'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'
import FileModel from '@models/file.model'
import BillingModel, { Billing } from '@models/finance/billing.model'
import { BillingListPayload, TotalBillingRecordPayload } from '@payloads/billingCycle.payloads'
import { BILLING_CYCLE_LIST } from '@pipelines/billingCycle.pipeline'
import { reformPaginate } from '@utils/pagination.utils'
import { GraphQLError } from 'graphql'
import { get, head, map, toNumber, toString, uniq } from 'lodash'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import pubsub, { NOTFICATIONS, SHIPMENTS } from '@configs/pubsub'
import BillingDocumentModel from '@models/finance/documents.model'
import UserModel from '@models/user.model'
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
import { getNewAllAvailableShipmentForDriver } from '@controllers/shipmentGet'
import { generateBillingReceipt } from '@controllers/billingReceipt'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'

@Resolver()
export default class BillingResolver {
  @Query(() => BillingListPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getBillingList(
    @Arg('data', { nullable: true }) data: GetBillingInput,
    @Args() paginate: PaginationArgs,
  ): Promise<BillingListPayload> {
    try {
      const { sort, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
      // Aggregrated
      console.log('BILLING_CYCLE_LIST: ', JSON.stringify(BILLING_CYCLE_LIST(data, sort)))
      const aggregate = BillingModel.aggregate(BILLING_CYCLE_LIST(data, sort))
      const _billings = (await BillingModel.aggregatePaginate(aggregate, reformSorts)) as BillingListPayload
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
    @Arg('type', () => EPaymentMethod) type: EPaymentMethod,
    @Arg('customerId', { nullable: true }) customerId: string,
  ): Promise<TotalBillingRecordPayload[]> {
    const user = customerId ? { user: customerId } : {}
    const all = await BillingModel.countDocuments({ paymentMethod: type, ...user })
    const pending = await BillingModel.countDocuments({ paymentMethod: type, status: EBillingStatus.PENDING, ...user })
    const verify = await BillingModel.countDocuments({ paymentMethod: type, status: EBillingStatus.VERIFY, ...user })
    const cancelled = await BillingModel.countDocuments({
      paymentMethod: type,
      status: EBillingStatus.CANCELLED,
      ...user,
    })
    const complete = await BillingModel.countDocuments({
      paymentMethod: type,
      status: EBillingStatus.COMPLETE,
      ...user,
    })

    return [
      { label: 'ทั้งหมด', key: EBillingCriteriaStatus.ALL, count: all },
      { label: 'รอชำระ/คืนเงิน', key: EBillingCriteriaStatus.PENDING, count: pending },
      { label: 'ตรวจสอบยอดชำระ', key: EBillingCriteriaStatus.VERIFY, count: verify },
      { label: 'สำเร็จ', key: EBillingCriteriaStatus.COMPLETE, count: complete },
      { label: 'ยกเลิก', key: EBillingCriteriaStatus.CANCELLED, count: cancelled },
    ]
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAllBillingIds(@Arg('data', { nullable: true }) data: GetBillingInput): Promise<string[]> {
    try {
      const billingCycles = await BillingModel.aggregate(BILLING_CYCLE_LIST(data, {}, { _id: 1 }))
      const ids = map(billingCycles, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => Billing)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async getBilling(@Ctx() ctx: GraphQLContext, @Arg('billingNumber') billingNumber: string): Promise<Billing> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const _billing = await BillingModel.findOne({
        billingNumber,
        ...(user_role === EUserRole.CUSTOMER ? { user: user_id } : {}),
      })
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

    const adminNotificationCount = await getAdminMenuNotificationCount()
    await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
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
    @Arg('documentId') documentId: string,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id
    const _billing = await BillingModel.findById(billingId).session(session)
    const _document = await BillingDocumentModel.findByIdAndUpdate(
      documentId,
      {
        receviedWHTDocumentDate: new Date(),
        updatedBy: adminId,
      },
      { session, new: true },
    )
    // Regenerate receipt
    await generateReceipt(_billing, _document.filename, session)
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
          await BillingDocumentModel.updateOne({ emailTime: new Date() })
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
          await BillingDocumentModel.updateOne({ emailTime: new Date() })
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
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async regenerateReceipt(
    @Arg('billingId') billingId: string,
    @Arg('documentId') documentId: string,
  ): Promise<boolean> {
    const _billing = await BillingModel.findById(billingId)
    const _document = await BillingDocumentModel.findById(documentId)
    await generateReceipt(_billing, _document.filename)
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
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
        const _shipment = await ShipmentModel.findOne({ trackingNumber: _billing.billingNumber }).lean()
        if (_shipment.status === EShipmentStatus.DELIVERED) {
          /**
           * Handle If shipment complete
           * CASH: Payment genrate new Receipt
           */
          await generateBillingReceipt(_billing._id, true, session)
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
          await ShipmentModel.findByIdAndUpdate(
            _shipment._id,
            {
              driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
              adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
            },
            { session },
          )
          shipmentNotify(_shipment._id, get(_shipment, 'requestedDriver._id', ''))
          const newShipments = await getNewAllAvailableShipmentForDriver('', {}, session)
          await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
          const adminNotificationCount = await getAdminMenuNotificationCount()
          await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
        }
      }
      return true
    } else if (data.result === 'reject') {
      await markBillingAsRejected(
        { billingId: data.billingId, paymentId: data.paymentId, reason: data.reason },
        adminId,
        session,
      )
      return true
    }
    return false
  }
}
