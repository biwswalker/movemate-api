import { GraphQLContext } from '@configs/graphQL.config'
import { generateDriverWHTCert } from '@controllers/driverPayment'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { CreateDriverPaymentInput, GetDriverPaymentArgs } from '@inputs/driver-payment.input'
import { PaginationArgs } from '@inputs/query.input'
import RetryTransactionMiddleware, { WithTransaction } from '@middlewares/RetryTransaction'
import DriverPaymentModel, { DriverPayment } from '@models/driverPayment.model'
import FileModel from '@models/file.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from '@models/transaction.model'
import UserModel from '@models/user.model'
import { DriverPaymentAggregatePayload } from '@payloads/driverPayment.payloads'
import { DRIVER_PAYMENTS } from '@pipelines/driverPayment.pipeline'
import { generateMonthlySequenceNumber, generateTrackingNumber } from '@utils/string.utils'
import { REPONSE_NAME } from 'constants/status'
import { format } from 'date-fns'
import { GraphQLError } from 'graphql'
import { isEmpty, map } from 'lodash'
import { Arg, Args, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import pubsub, { NOTFICATIONS } from '@configs/pubsub'
import { generateDriverReceipt } from 'reports/driverReceipt'

@Resolver()
export default class DriverPaymentResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async createDriverPayment(
    @Ctx() ctx: GraphQLContext,
    @Arg('driverId') driverId: string,
    @Arg('data') data: CreateDriverPaymentInput,
  ): Promise<boolean> {
    const session = ctx.session
    const userId = ctx.req.user_id
    if (!driverId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    // 1. ตรวจสอบว่ามี transactionIds ส่งมาหรือไม่
    if (isEmpty(data.transactionIds)) {
      throw new GraphQLError('กรุณาเลือกรายการที่ต้องการชำระ')
    }

    // 2. ดึงข้อมูล transaction จากฐานข้อมูลเพื่อตรวจสอบสถานะล่าสุด
    const transactionsInDB = await TransactionModel.find({ _id: { $in: data.transactionIds } }).session(session)

    // 3. ตรวจสอบว่าหาเจอครบทุกรายการหรือไม่
    if (transactionsInDB.length !== data.transactionIds.length) {
      throw new GraphQLError('ไม่พบ transaction บางรายการ กรุณารีเฟรชและลองใหม่อีกครั้ง')
    }

    // 4. ตรวจสอบว่ามีรายการใดที่ไม่ใช่สถานะ PENDING หรือไม่
    const alreadyProcessed = transactionsInDB.some((t) => t.status !== ETransactionStatus.PENDING)
    if (alreadyProcessed) {
      throw new GraphQLError('มีบางรายการที่ถูกดำเนินการไปแล้ว กรุณารีเฟรชและลองใหม่อีกครั้ง')
    }

    const shipments = transactionsInDB.map((transaction) => transaction.refId)

    // Update shipment trnasaction
    await TransactionModel.updateMany(
      {
        _id: { $in: data.transactionIds },
        status: ETransactionStatus.PENDING,
      },
      { status: ETransactionStatus.COMPLETE },
      { session },
    )
    // Update transaction to complete

    const imageEvidence = new FileModel(data.imageEvidence)
    await imageEvidence.save({ session })

    const today = new Date()
    const generateMonth = format(today, 'yyMM')
    const generateFullYearMonth = format(today, 'yyyyMM')
    // GENERATE PaymentNumber
    const _paymentNumber = await generateMonthlySequenceNumber('driver-receipt')
    const _whtNumber = await generateTrackingNumber(`WHT-TE${generateFullYearMonth}`, 'wht', 3)

    // Create driver payment detail
    const driverPayment = new DriverPaymentModel({
      driver: driverId,
      paymentNumber: _paymentNumber,
      whtNumber: _whtNumber,
      imageEvidence,
      transactions: transactionsInDB,
      shipments,
      paymentDate: data.paymentDate,
      paymentTime: data.paymentTime,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      createdBy: userId,
    })

    await driverPayment.save({ session })

    const _newDriverPayment = await DriverPaymentModel.findById(driverPayment._id).session(session)

    const { document } = await generateDriverReceipt(_newDriverPayment, session)
    if(document) {
      await _newDriverPayment.updateOne({ receiptDocument: document }, { session })
    }

    // Add transaction For Driver
    const descriptionForDriver = `ได้รับค่างานขนส่ง ${shipments.length} รายการ`
    const driverTransaction = new TransactionModel({
      amountBeforeTax: data.subtotal,
      amountTax: data.tax,
      amount: data.total,
      ownerId: driverId,
      ownerType: ETransactionOwner.DRIVER,
      description: descriptionForDriver,
      refId: driverPayment._id,
      refType: ERefType.EARNING,
      transactionType: ETransactionType.OUTCOME,
      status: ETransactionStatus.COMPLETE,
    })
    await driverTransaction.save({ session })

    // Add transaction For Admin
    const driver = await UserModel.findById(driverId).session(session)
    const descriptionForAdmin = `ชำระค่าขนส่งคนขับหมายเลข ${driver.userNumber} (ใบสำคัญจ่าย #${_paymentNumber})`
    const movemateTransaction = new TransactionModel({
      amountBeforeTax: data.subtotal,
      amountTax: data.tax,
      amount: data.total,
      ownerId: MOVEMATE_OWNER_ID,
      ownerType: ETransactionOwner.MOVEMATE,
      description: descriptionForAdmin,
      refId: driverPayment._id,
      refType: ERefType.EARNING,
      transactionType: ETransactionType.OUTCOME,
      status: ETransactionStatus.COMPLETE,
    })
    await movemateTransaction.save({ session })

    // ออกเอกสาร
    const documentId = await generateDriverWHTCert(driverPayment._id, session)
    await DriverPaymentModel.findByIdAndUpdate(driverPayment._id, { document: documentId }, { session })

    await getAdminMenuNotificationCount(session)
    return true
  }

  @Query(() => DriverPaymentAggregatePayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverPayments(
    @Args() queries: GetDriverPaymentArgs,
    @Args() paginates: PaginationArgs,
  ): Promise<DriverPaymentAggregatePayload> {
    const driverPayments = await DriverPaymentModel.getDriverPayments(queries, paginates)
    return driverPayments
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverPaymentIds(@Args() queries: GetDriverPaymentArgs): Promise<string[]> {
    const driverPayments = await DriverPaymentModel.aggregate(DRIVER_PAYMENTS(queries, {}))
    const ids = map(driverPayments, ({ _id }) => _id)
    return ids
  }

  @Query(() => DriverPayment)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDriverPaymentByPaymentNumber(@Arg('paymentNumber') paymentNumber: string): Promise<DriverPayment> {
    const driverPayments = await DriverPaymentModel.findOne({ paymentNumber })
    return driverPayments
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async confirmReceiveReceiptDocument(
    @Arg('paymentNumber') paymentNumber: string,
    @Arg('documentNumber') documentNumber: string,
    @Arg('receiveDate') receiveDate: Date,
  ): Promise<boolean> {
    await DriverPaymentModel.findOneAndUpdate(
      { paymentNumber },
      { whtBookNo: documentNumber, receiveReceiptDate: receiveDate },
    )
    return true
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async regenerateDriverReceipt(
    @Ctx() ctx: GraphQLContext,
    @Arg('paymentNumber') paymentNumber: string,
  ): Promise<boolean> {
    const session = ctx.session
    const _driverPayment = await DriverPaymentModel.findOne({ paymentNumber }).session(session)
    if (_driverPayment) {
      const { document } = await generateDriverReceipt(_driverPayment, session)
      if (isEmpty(_driverPayment.receiptDocument)) {
        await DriverPaymentModel.findOneAndUpdate({ paymentNumber }, { receiptDocument: document }).session(session)
      }
    }
    return true
  }
}
