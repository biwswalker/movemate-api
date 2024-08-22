import { Resolver, Mutation, UseMiddleware, Ctx, Args } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { ApprovalCashPaymentArgs } from '@inputs/payment.input'
import PaymentModel, { EPaymentStatus } from '@models/payment.model'
import { GraphQLError } from 'graphql'
import { REPONSE_NAME } from 'constants/status'
import UpdateHistoryModel from '@models/updateHistory.model'
import ShipmentModel, { EAdminAcceptanceStatus, EShipingStatus } from '@models/shipment.model'
import lodash, { filter, find, last } from 'lodash'
import StepDefinitionModel, { EStepDefinitionName, EStepStatus, StepDefinition } from '@models/shipmentStepDefinition.model'
import Aigle from 'aigle'
import NotificationModel from '@models/notification.model'

Aigle.mixin(lodash, {});

@Resolver()
export default class PaymentResolver {

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async approvalCashPayment(@Ctx() ctx: GraphQLContext, @Args() args: ApprovalCashPaymentArgs): Promise<boolean> {
    const userId = ctx.req.user_id
    const shipment = await ShipmentModel.findById(args.shipmentId).lean()
    if (!shipment) {
      const message = "ไม่สามารถหาข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว";
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const payment = await PaymentModel.findById(args._id).lean()
    if (!payment) {
      const message = "ไม่สามารถหาข้อมูลการชำระได้ เนื่องจากไม่พบการชำระดังกล่าว";
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    if (args.result === 'approve') {
      // Payment
      const paymentUpdateHistory = new UpdateHistoryModel({
        referenceId: args._id,
        referenceType: "Payment",
        who: userId,
        beforeUpdate: payment,
        afterUpdate: { ...payment, status: 'paid' },
      });
      await paymentUpdateHistory.save()
      await PaymentModel.findByIdAndUpdate(args._id, {
        status: EPaymentStatus.PAID,
        $push: { history: paymentUpdateHistory }
      })
      // Shipment
      const shipmentModel = await ShipmentModel.findById(args.shipmentId)
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      if (currentStep) {
        if (currentStep.step === 'CASH_VERIFY') {
          shipmentModel.nextStep()
        }
      }
      const shipmentUpdateHistory = new UpdateHistoryModel({
        referenceId: args.shipmentId,
        referenceType: "Shipment",
        who: userId,
        beforeUpdate: shipment,
        afterUpdate: { ...shipment, status: EShipingStatus.IDLE, adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED, steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }] },
      });
      await ShipmentModel.findByIdAndUpdate(args.shipmentId, {
        status: EShipingStatus.IDLE,
        adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
        $push: { history: shipmentUpdateHistory }
      })

      /**
         * Sent notification
         */
      // Notification
      await NotificationModel.sendNotification({
        userId: shipment.customer as string,
        varient: 'info',
        title: 'การจองของท่านยืนยันยอดชำระแล้ว',
        message: [`เราขอแจ้งให้ท่าทราบว่าการจองรถเลขที่ ${shipment.trackingNumber} ของท่านยืนยันยอดชำระแล้ว`, `การจองจะถูกดำเนินการจับคู่หาคนขับในไม่ช้า`],
        infoText: 'ดูการจอง',
        infoLink: `/main/tracking/${shipment.trackingNumber}`,
      })
      // TODO: add email
      return true
    } else if (args.result === 'reject') {
      if (!args.reason) {
        const message = "ไม่สามารถทำรายการได้ เนื่องจากไม่พบเหตุผลการไม่อนุมัติ";
        throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
      }
      // Payment
      const updateData = { status: EPaymentStatus.REFUND, rejectionReason: args.reason, rejectionOtherReason: args.otherReason || '' }
      const updateHistory = new UpdateHistoryModel({
        referenceId: args._id,
        referenceType: "Payment",
        who: userId,
        beforeUpdate: payment,
        afterUpdate: { ...payment, ...updateData },
      });
      await updateHistory.save()
      await PaymentModel.findByIdAndUpdate(args._id, {
        ...updateData,
        $push: { history: updateHistory }
      })
      // Shipment
      const shipmentModel = await ShipmentModel.findById(args.shipmentId)
      const currentStep = find(shipmentModel.steps, ['seq', shipmentModel.currentStepSeq]) as StepDefinition | undefined
      const lastStep = last(shipmentModel.steps) as StepDefinition
      if (currentStep) {
        const deniedSteps = filter(shipmentModel.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
        const steps = await Aigle.map(deniedSteps, async (step) => {
          await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED })
          return { ...step, stepStatus: EStepStatus.CANCELLED }
        })
        const rejectedPaymentStep = new StepDefinitionModel({
          step: 'REJECTED_PAYMENT',
          seq: lastStep.seq + 1,
          stepName: EStepDefinitionName.REJECTED_PAYMENT,
          customerMessage: EStepDefinitionName.REJECTED_PAYMENT,
          driverMessage: EStepDefinitionName.REJECTED_PAYMENT,
          stepStatus: 'done',
        })
        const refundStep = new StepDefinitionModel({
          step: 'REFUND',
          seq: lastStep.seq + 2,
          stepName: EStepDefinitionName.REFUND,
          customerMessage: EStepDefinitionName.REFUND,
          driverMessage: EStepDefinitionName.REFUND,
          stepStatus: 'progressing',
        })
        await rejectedPaymentStep.save()
        await refundStep.save()
        const shipmentUpdateHistory = new UpdateHistoryModel({
          referenceId: args.shipmentId,
          referenceType: "Shipment",
          who: userId,
          beforeUpdate: { ...shipment, steps: shipmentModel.steps },
          afterUpdate: { ...shipment, status: EShipingStatus.REFUND, adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED, steps: [...steps, rejectedPaymentStep, refundStep] },
        });
        await ShipmentModel.findByIdAndUpdate(args.shipmentId, {
          status: EShipingStatus.REFUND,
          adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
          currentStepSeq: lastStep.seq + 2,
          $push: { history: shipmentUpdateHistory, steps: rejectedPaymentStep._id }
        })
        await ShipmentModel.findByIdAndUpdate(args.shipmentId, { $push: { steps: refundStep._id } })

        /**
         * Sent notification
         */
        // Notification
        await NotificationModel.sendNotification({
          userId: shipment.customer as string,
          varient: 'error',
          title: 'การจองถูกยกเลิก',
          message: [`เราเสียใจที่ต้องแจ้งให้ท่านทราบว่าการจองเลขที่ ${shipment.trackingNumber} ของท่านถูกยกเลิกโดยทีมผู้ดูแลระบบของเรา`, `สาเหตุการยกเลิกคือ ${args.otherReason} และการจองจะถูกดำเนินการคืนเงินต่อไป`],
          infoText: 'ดูการจอง',
          infoLink: `/main/tracking/${shipment.trackingNumber}`,
        })
        // TODO: add email
      }
      return true
    }

    return false
  }
}
