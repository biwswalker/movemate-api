import { Resolver, Mutation, UseMiddleware, Ctx, Args } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { ApprovalCashPaymentArgs, ApproveCreditPaymentArgs } from '@inputs/billingPayment.input'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import lodash, { get, head } from 'lodash'
import Aigle from 'aigle'
import BillingCycleModel from '@models/billingCycle.model'
import BillingPaymentModel from '@models/billingPayment.model'
import FileModel from '@models/file.model'
import { format, parse } from 'date-fns'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
  MOVEMATE_OWNER_ID,
} from '@models/transaction.model'
import { shipmentNotify } from './shipment.resolvers'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import pubsub, { NOTFICATIONS, SHIPMENTS } from '@configs/pubsub'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import { EUserRole } from '@enums/users'

Aigle.mixin(lodash, {})

@Resolver()
export default class BillingPaymentResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async approvalCashPayment(@Ctx() ctx: GraphQLContext, @Args() args: ApprovalCashPaymentArgs): Promise<boolean> {
    const user_id = ctx.req.user_id
    const billingCycleModel = await BillingCycleModel.findById(args.billingCycleId).lean()
    const billingPaymentModel = await BillingPaymentModel.findById(billingCycleModel.billingPayment).lean()
    if (!billingCycleModel || !billingPaymentModel) {
      const message = 'ไม่สามารถหาข้อมูลการชำระได้ เนื่องจากไม่พบการชำระดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (args.result === 'approve') {
      await BillingCycleModel.markAsPaid(billingCycleModel._id, user_id)

      // For Movemate transaction
      const movemateTransaction = new TransactionModel({
        amount: billingPaymentModel.paymentAmount,
        ownerId: MOVEMATE_OWNER_ID,
        ownerType: ETransactionOwner.MOVEMATE,
        description: `ยืนยันการชำระเงินหมายเลข ${billingCycleModel.billingNumber}`,
        refId: billingCycleModel._id,
        refType: ERefType.BILLING,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await movemateTransaction.save()
      const shipment = head(billingCycleModel.shipments) as Shipment
      if (shipment) {
        shipmentNotify(shipment._id, get(shipment, 'requestedDriver._id', ''))
        const newShipments = await ShipmentModel.getNewAllAvailableShipmentForDriver()
        await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
        const adminNotificationCount = await getAdminMenuNotificationCount()
        await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)
      }
      return true
    } else if (args.result === 'reject') {
      await BillingCycleModel.rejectedPayment(billingCycleModel._id, user_id, args.reason, args.otherReason)
      return true
    }
    return false
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async approveCreditPayment(@Ctx() ctx: GraphQLContext, @Args() data: ApproveCreditPaymentArgs): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const billingCycleModel = await BillingCycleModel.findById(data.billingCycleId).lean()
      if (!billingCycleModel) {
        const message = 'ไม่สามารถหาข้อมูลการชำระได้ เนื่องจากไม่พบการชำระดังกล่าว'
        throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
      }

      const imageEvidenceFile = data.imageEvidence ? new FileModel(data.imageEvidence) : null
      imageEvidenceFile && (await imageEvidenceFile.save())

      const paydate = format(data.paymentDate, 'dd/MM/yyyy')
      const paytime = format(data.paymentTime, 'HH:mm')
      const paymentDate = parse(`${paydate} ${paytime}`, 'dd/MM/yyyy HH:mm', new Date())
      await BillingCycleModel.markAsPaid(
        data.billingCycleId,
        user_id,
        paymentDate.toISOString(),
        imageEvidenceFile ? imageEvidenceFile._id : '',
      )
      // For Movemate transaction
      const movemateTransaction = new TransactionModel({
        amount: billingCycleModel.totalAmount,
        ownerId: MOVEMATE_OWNER_ID,
        ownerType: ETransactionOwner.MOVEMATE,
        description: `ยืนยันการชำระเงินหมายเลข ${billingCycleModel.billingNumber}`,
        refId: billingCycleModel._id,
        refType: ERefType.BILLING,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await movemateTransaction.save()

      const adminNotificationCount = await getAdminMenuNotificationCount()
      await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)

      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}
