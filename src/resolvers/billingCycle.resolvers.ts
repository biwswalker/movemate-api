import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { BillingCycleRefundArgs, GetBillingCycleArgs } from '@inputs/billingCycle.input'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import BillingCycleModel, { BillingCycle, EBillingStatus, PostalDetail } from '@models/billingCycle.model'
import FileModel, { File } from '@models/file.model'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import { BillingCyclePaginationAggregatePayload, TotalBillingRecordPayload } from '@payloads/billingCycle.payloads'
import { BILLING_CYCLE_LIST } from '@pipelines/billingCycle.pipeline'
import addEmailQueue from '@utils/email.utils'
import { reformPaginate } from '@utils/pagination.utils'
import { addDays, format, parse, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { GraphQLError } from 'graphql'
import { get, isEmpty, map, omitBy, toNumber, toString, uniq } from 'lodash'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import path from 'path'
import { EPaymentMethod } from '@models/payment.model'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import { generateReceipt } from 'reports/receipt'

@Resolver(BillingCycle)
export default class BillingCycleResolver {
  @Query(() => BillingCyclePaginationAggregatePayload)
  @UseMiddleware(AuthGuard(['admin']))
  async billingCycleList(
    @Args() query: GetBillingCycleArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<BillingCyclePaginationAggregatePayload> {
    try {
      const { sort, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
      const filterQuery = omitBy(query, isEmpty)
      // Aggregrated
      console.log('BILLING_CYCLE_LIST: ', JSON.stringify(BILLING_CYCLE_LIST(filterQuery, sort)))
      const aggregate = BillingCycleModel.aggregate(BILLING_CYCLE_LIST(filterQuery, sort))
      const billingCycles = (await BillingCycleModel.aggregatePaginate(
        aggregate,
        reformSorts,
      )) as BillingCyclePaginationAggregatePayload
      if (!billingCycles) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return billingCycles
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => [TotalBillingRecordPayload])
  @UseMiddleware(AuthGuard(['admin']))
  async statusBillingCount(
    @Arg('type', () => EPaymentMethod) type: EPaymentMethod,
    @Arg('customerId', { nullable: true }) customerId: string,
  ): Promise<TotalBillingRecordPayload[]> {
    const user = customerId ? { user: customerId } : {}
    const all = await BillingCycleModel.countDocuments({
      paymentMethod: type,
      ...(type === EPaymentMethod.CASH
        ? {
            billingStatus: {
              $in: [EBillingStatus.VERIFY, EBillingStatus.REFUND, EBillingStatus.PAID, EBillingStatus.REFUNDED],
            },
          }
        : {}),
      ...user,
    })
    const verify = await BillingCycleModel.countDocuments({
      paymentMethod: type,
      billingStatus: EBillingStatus.VERIFY,
      ...user,
    })
    const refund = await BillingCycleModel.countDocuments({
      paymentMethod: type,
      billingStatus: EBillingStatus.REFUND,
      ...user,
    })
    const paid = await BillingCycleModel.countDocuments({
      paymentMethod: type,
      billingStatus: EBillingStatus.PAID,
      ...user,
    })
    const refunded = await BillingCycleModel.countDocuments({
      paymentMethod: type,
      billingStatus: EBillingStatus.REFUNDED,
      ...user,
    })

    if (type === EPaymentMethod.CASH) {
      return [
        { label: 'ทั้งหมด', key: 'all', count: all },
        { label: 'ตรวจสอบยอดชำระ', key: EBillingStatus.VERIFY, count: verify },
        { label: 'คืนเงิน', key: EBillingStatus.REFUND, count: refund },
        { label: 'ชำระเงินแล้ว', key: EBillingStatus.PAID, count: paid },
        { label: 'คืนเงินแล้ว', key: EBillingStatus.REFUNDED, count: refunded },
      ]
    } else if (type === EPaymentMethod.CREDIT) {
      const overdue = await BillingCycleModel.countDocuments({
        paymentMethod: type,
        billingStatus: EBillingStatus.OVERDUE,
        ...user,
      })
      const current = await BillingCycleModel.countDocuments({
        paymentMethod: type,
        billingStatus: EBillingStatus.CURRENT,
        ...user,
      })
      return [
        { label: 'ทั้งหมด', key: 'all', count: all },
        { label: 'ตรวจสอบยอดชำระ', key: EBillingStatus.VERIFY, count: verify },
        { label: 'คืนเงิน', key: EBillingStatus.REFUND, count: refund },
        { label: 'เกินกำหนดชำระ', key: EBillingStatus.OVERDUE, count: overdue },
        { label: 'อยู่ในรอบบิล', key: EBillingStatus.CURRENT, count: current },
        { label: 'คืนเงินแล้ว', key: EBillingStatus.REFUNDED, count: refunded },
        { label: 'ชำระเงินแล้ว', key: EBillingStatus.PAID, count: paid },
      ]
    }
    return []
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard(['admin']))
  async allBillingCycleIds(@Args() query: GetBillingCycleArgs): Promise<string[]> {
    try {
      const filterQuery = omitBy(query, isEmpty)
      const billingCycles = await BillingCycleModel.aggregate(BILLING_CYCLE_LIST(filterQuery))
      const ids = map(billingCycles, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => BillingCycle)
  @UseMiddleware(AuthGuard(['admin', 'customer']))
  async billingCycle(@Ctx() ctx: GraphQLContext, @Arg('billingNumber') billingNumber: string): Promise<BillingCycle> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const billingCycle = await BillingCycleModel.findOne({
        billingNumber,
        ...(user_role === 'customer' ? { user: user_id } : {}),
      })
      if (!billingCycle) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return billingCycle
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => String)
  @UseMiddleware(AuthGuard(['admin']))
  async billingNumberByShipment(@Arg('trackingNumber') trackingNumber: string): Promise<string> {
    try {
      const shipment = await ShipmentModel.findOne({ trackingNumber })
      const billingCycle = await BillingCycleModel.findOne({ shipments: { $in: [shipment._id] } })
      return billingCycle.billingNumber || ''
    } catch (error) {
      console.log(error)
      return ''
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async refund(@Ctx() ctx: GraphQLContext, @Args() data: BillingCycleRefundArgs): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const imageEvidenceFile = new FileModel(data.imageEvidence)
      await imageEvidenceFile.save()
      await BillingCycleModel.markAsRefund(
        {
          billingCycleId: data.billingCycleId,
          imageEvidenceId: imageEvidenceFile._id,
          paymentDate: data.paymentDate,
          paymentTime: data.paymentTime,
        },
        user_id,
      )
      const adminNotificationCount = await getAdminMenuNotificationCount()
      await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async norefund(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingCycleId') billingCycleId: string,
    @Arg('reason', { nullable: true }) reason?: string,
  ): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      await BillingCycleModel.markAsNoRefund(billingCycleId, user_id, reason)
      const adminNotificationCount = await getAdminMenuNotificationCount()
      await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async confirmInvoiceSent(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingCycleId') billingCycleId: string,
    @Arg('trackingNumber') trackingNumber: string,
    @Arg('postalProvider') postalProvider: string,
  ): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const postalSented: PostalDetail = {
        createdDateTime: new Date(),
        postalProvider,
        trackingNumber,
        updatedBy: user_id,
      }
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, { postalInvoice: postalSented })
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async confirmReceiptSent(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingCycleId') billingCycleId: string,
    @Arg('trackingNumber') trackingNumber: string,
    @Arg('postalProvider') postalProvider: string,
  ): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const postalSented: PostalDetail = {
        createdDateTime: new Date(),
        postalProvider,
        trackingNumber,
        updatedBy: user_id,
      }
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, { postalReceipt: postalSented })
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async confirmReceiveWHT(@Ctx() ctx: GraphQLContext, @Arg('billingCycleId') billingCycleId: string): Promise<boolean> {
    try {
      await BillingCycleModel.findByIdAndUpdate(billingCycleId, { receivedWHTDocumentTime: new Date() })
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async resentInvoiceToEmail(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingCycleId') billingCycleId: string,
  ): Promise<boolean> {
    try {
      const billingCycleModel = await BillingCycleModel.findById(billingCycleId)
      const customerModel = await UserModel.findById(billingCycleModel.user)
      if (customerModel) {
        const financialEmails = get(customerModel, 'businessDetail.creditPayment.financialContactEmails', [])
        const emails = uniq([customerModel.email, ...financialEmails])
        const month_text = format(new Date(), 'MMMM', { locale: th })
        const year_number = toNumber(format(new Date(), 'yyyy', { locale: th }))
        const year_text = toString(year_number + 543)
        const filePath = path.join(__dirname, '..', '..', 'generated/invoice', billingCycleModel.issueInvoiceFilename)

        await addEmailQueue({
          from: process.env.NOREPLY_EMAIL,
          to: emails,
          subject: `[Auto Email] Movemate Thailand ใบแจ้งหนี้ค่าบริการ ${billingCycleModel.billingNumber}`,
          template: 'notify_invoice',
          context: {
            business_name: customerModel.fullname,
            month_text,
            year_text,
            financial_email: 'acc@movematethailand.com',
            contact_number: '02-xxx-xxxx',
            movemate_link: `https://www.movematethailand.com`,
          },
          attachments: [{ filename: path.basename(filePath), path: filePath }],
        })
        await billingCycleModel.updateOne({ emailSendedTime: new Date() })
        console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
      }
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async resentReceiptToEmail(
    @Ctx() ctx: GraphQLContext,
    @Arg('billingCycleId') billingCycleId: string,
  ): Promise<boolean> {
    try {
      const billingCycleModel = await BillingCycleModel.findById(billingCycleId)
      const customerModel = await UserModel.findById(billingCycleModel.user)
      if (customerModel) {
        const financialEmails = get(customerModel, 'businessDetail.creditPayment.financialContactEmails', [])
        const emails = uniq([customerModel.email, ...financialEmails])
        const filePath = path.join(__dirname, '..', '..', 'generated/receipt', billingCycleModel.issueReceiptFilename)

        const businessContactNumber = get(customerModel, 'businessDetail.contactNumber', '')
        await addEmailQueue({
          from: process.env.NOREPLY_EMAIL,
          to: emails,
          subject: `ใบเสร็จรับเงิน Movemate Thailand`,
          template: 'notify_receipt',
          context: {
            business_name: customerModel.fullname,
            business_contact_number: businessContactNumber,
            business_email: customerModel.email,
            customer_type: customerModel.userType === 'individual' ? 'ส่วนบุคคล' : 'บริษัท/องค์กร',
            financial_email: 'acc@movematethailand.com',
            contact_number: '02-xxx-xxxx',
            movemate_link: `https://www.movematethailand.com`,
          },
          attachments: [{ filename: path.basename(filePath), path: filePath }],
        })
        await billingCycleModel.updateOne({ emailSendedReceiptTime: new Date() })
        console.log(`[${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}] Billing Cycle has sent for ${emails.join(', ')}`)
      }
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  // Integrated this
  @Query(() => Boolean)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'customer']))
  async isNearbyDuedate(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const currentday = new Date()
      const today = currentday.setHours(0, 0, 0, 0)
      const threeDaysLater = addDays(currentday, 3).setHours(23, 59, 59, 999)
      const billingCycleModel = await BillingCycleModel.find({
        user: user_id,
        billingStatus: EBillingStatus.CURRENT,
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

  @Query(() => [BillingCycle])
  @UseMiddleware(AuthGuard(['customer', 'admin']))
  async monthBilling(
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
        console.log('---monthBilling---', startDate, endDate)
        const billings = await BillingCycleModel.find({
          user: userId,
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
  @UseMiddleware(AuthGuard(['customer', 'admin']))
  async totalMonthBilling(@Ctx() ctx: GraphQLContext, @Arg('monthofyear') monthofyear: string): Promise<number> {
    const userId = ctx.req.user_id
    if (userId) {
      const month = parse(monthofyear, 'MM/yyyy', new Date())
      const startDate = startOfMonth(month)
      const endDate = endOfMonth(month)
      console.log('---monthBilling---', startDate, endDate)
      const total = await BillingCycleModel.countDocuments({
        user: userId,
        issueDate: { $gt: startDate.setHours(0, 0, 0, 0), $lt: endDate.setHours(23, 59, 59, 999) },
      })
      return total
    }
    return 0
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async regenerateReceipt(@Arg('billingCycleId') billingCycleId: string): Promise<boolean> {
    const billing = await BillingCycleModel.findById(billingCycleId)
    await generateReceipt(billing, billing.issueReceiptFilename)
    return true
  }
}
