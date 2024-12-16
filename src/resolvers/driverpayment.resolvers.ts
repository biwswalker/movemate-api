import { GraphQLContext } from '@configs/graphQL.config'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { CreateDriverPaymentInput, GetDriverPaymentArgs } from '@inputs/driver-payment.input'
import { PaginationArgs } from '@inputs/query.input'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'
import DriverPaymentModel from '@models/driverPayment.model'
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
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import { map } from 'lodash'
import { Arg, Args, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'

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
    if (!userId) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const driver = await UserModel.findById(driverId)
    const transactions = await TransactionModel.find({ _id: { $in: data.transactionIds }, refType: ERefType.SHIPMENT })
    const shipments = transactions.map((transaction) => transaction.refId)

    // Update shipment trnasaction
    await TransactionModel.updateMany(
      {
        _id: { $in: data.transactionIds },
        refType: ERefType.SHIPMENT,
        status: ETransactionStatus.PENDING,
      },
      { status: ETransactionStatus.COMPLETE },
      { session },
    )
    // Update transaction to complete

    const imageEvidence = new FileModel(data.imageEvidence)
    await imageEvidence.save({ session })

    // Create driver payment detail
    const driverPayment = new DriverPaymentModel({
      driver: driverId,
      imageEvidence,
      transactions,
      shipments,
      paymentDate: data.paymentDate,
      paymentTime: data.paymentTime,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      createdBy: userId,
    })

    await driverPayment.save({ session })

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
    const descriptionForAdmin = `ชำระค่าขนส่งคนขับหมายเลข ${driver.userNumber}`
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
    const driverPayments = await TransactionModel.aggregate(DRIVER_PAYMENTS(queries, {}))
    const ids = map(driverPayments, ({ _id }) => _id)
    return ids
  }
}
