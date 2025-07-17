import ShipmentModel from '@models/shipment.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import { REPONSE_NAME } from 'constants/status'
import { GraphQLError } from 'graphql'
import lodash, { filter, find, get, last } from 'lodash'
import { ClientSession } from 'mongoose'
import { nextStep } from './shipmentOperation'
import UpdateHistoryModel from '@models/updateHistory.model'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import Aigle from 'aigle'

Aigle.mixin(lodash, {})

interface MarkShipmentVerifiedInput {
  shipmentId: string
  result: 'approve' | 'reject'
  reason?: string
}

export async function markShipmentVerified(input: MarkShipmentVerifiedInput, adminId: string, session?: ClientSession) {
  const { shipmentId, result, reason } = input

  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!_shipment) {
    const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  if (result === 'approve') {
    const currentStep = find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
    if (currentStep) {
      if (currentStep.step === EStepDefinition.CASH_VERIFY) {
        await nextStep(shipmentId, undefined, session)
      }
    }
    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: shipmentId,
      referenceType: 'Shipment',
      who: adminId,
      beforeUpdate: _shipment,
      afterUpdate: {
        ..._shipment,
        status: EShipmentStatus.IDLE,
        adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
        driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
        steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }],
      },
    })
    await _shipmentUpdateHistory.save({ session })
    await ShipmentModel.findByIdAndUpdate(
      shipmentId,
      {
        status: EShipmentStatus.IDLE,
        adminAcceptanceStatus: EAdminAcceptanceStatus.ACCEPTED,
        driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
        $push: { history: _shipmentUpdateHistory },
      },
      { session },
    )

    /**
     * Sent notification
     */
    await NotificationModel.sendNotification(
      {
        userId: get(_shipment, 'customer._id', ''),
        varient: ENotificationVarient.INFO,
        title: 'การจองของท่านยืนยันยอดชำระแล้ว',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองรถเลขที่ ${_shipment.trackingNumber} ของท่านยืนยันยอดชำระแล้ว`,
          `การจองจะถูกดำเนินการจับคู่หาคนขับในไม่ช้า`,
        ],
        infoText: 'ดูการจอง',
        infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
      },
      session,
    )
    /**
     * Sent email ?
     */
  } else if (result === 'reject') {
    if (!reason) {
      const message = 'ไม่สามารถทำรายการได้ เนื่องจากไม่พบเหตุผลการไม่อนุมัติ'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }
    const currentStep = find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
    const lastStep = last(_shipment.steps) as StepDefinition
    if (currentStep) {
      const deniedSteps = filter(_shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
      const steps = await Aigle.map(deniedSteps, async (step) => {
        const isCashVerifyStep = step.step === EStepDefinition.CASH_VERIFY && step.seq === currentStep.seq
        const cashVerifyStepChangeData = isCashVerifyStep
          ? {
              step: EStepDefinition.REJECTED_PAYMENT,
              stepName: EStepDefinitionName.REJECTED_PAYMENT,
              customerMessage: EStepDefinitionName.REJECTED_PAYMENT,
              driverMessage: EStepDefinitionName.REJECTED_PAYMENT,
            }
          : {}
        await StepDefinitionModel.findByIdAndUpdate(
          step._id,
          {
            stepStatus: EStepStatus.CANCELLED,
            ...cashVerifyStepChangeData,
          },
          { session },
        )
        return { ...step, stepStatus: EStepStatus.CANCELLED, ...cashVerifyStepChangeData }
      })
      // Add refund step
      const newLatestSeq = lastStep.seq + 1
      const refundStep = new StepDefinitionModel({
        step: EStepDefinition.REFUND,
        seq: newLatestSeq,
        stepName: EStepDefinitionName.REFUND,
        customerMessage: EStepDefinitionName.REFUND,
        driverMessage: EStepDefinitionName.REFUND,
        stepStatus: EStepStatus.PROGRESSING,
      })
      await refundStep.save({ session })
      // Update history
      const _shipmentUpdateHistory = new UpdateHistoryModel({
        referenceId: shipmentId,
        referenceType: 'Shipment',
        who: adminId,
        beforeUpdate: _shipment,
        afterUpdate: {
          ..._shipment,
          status: EShipmentStatus.REFUND,
          adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
          steps: [...steps, refundStep],
        },
      })
      await _shipmentUpdateHistory.save({ session })
      await ShipmentModel.findByIdAndUpdate(
        shipmentId,
        {
          status: EShipmentStatus.REFUND,
          adminAcceptanceStatus: EAdminAcceptanceStatus.REJECTED,
          currentStepSeq: newLatestSeq,
          $push: { history: _shipmentUpdateHistory, steps: refundStep._id },
        },
        { session },
      )

      /**
       * Sent notification
       */
      await NotificationModel.sendNotification(
        {
          userId: get(_shipment, 'customer._id', ''),
          varient: ENotificationVarient.ERROR,
          title: 'การจองถูกยกเลิก',
          message: [
            `เราเสียใจที่ต้องแจ้งให้ท่านทราบว่าการจองเลขที่ ${_shipment.trackingNumber} ของท่านถูกยกเลิกโดยทีมผู้ดูแลระบบของเรา`,
            `สาเหตุการยกเลิกคือ ${reason} และการจองจะถูกดำเนินการคืนเงินต่อไป`,
          ],
          infoText: 'ดูการจอง',
          infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
        },
        session,
      )
      /**
       * Sent email
       */
    }
  }
}

export async function markShipmentAsRefunded(shipmentId: string, adminId: string, session?: ClientSession) {
  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!_shipment) {
    const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  const currentStep = find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
  if (currentStep) {
    if (currentStep.step === EStepDefinition.REFUND) {
      await StepDefinitionModel.findByIdAndUpdate(
        currentStep._id,
        {
          stepStatus: EStepStatus.DONE,
          customerMessage: 'ดำเนินการคืนเงินแล้ว',
          driverMessage: 'ดำเนินการคืนเงินแล้ว',
        },
        { session },
      )
    }
  }

  if (_shipment.status !== EShipmentStatus.CANCELLED) {
    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: shipmentId,
      referenceType: 'Shipment',
      who: adminId,
      beforeUpdate: _shipment,
      afterUpdate: { ..._shipment, steps: [{ ...currentStep, stepStatus: EStepStatus.DONE }] },
    })
    await _shipmentUpdateHistory.save({ session })
    await ShipmentModel.findByIdAndUpdate(
      shipmentId,
      {
        status: EShipmentStatus.CANCELLED,
        $push: { history: _shipmentUpdateHistory },
      },
      { session },
    )
  }
}

export async function markShipmentAsNoRefund(shipmentId: string, adminId: string, session?: ClientSession) {
  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!_shipment) {
    const message = 'ไม่สามารถหาข้อมูลงานขนส่ง เนื่องจากไม่พบงานขนส่งดังกล่าว'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  const currentStep = find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
  if (currentStep) {
    if (currentStep.step === 'REFUND') {
      await StepDefinitionModel.findByIdAndUpdate(currentStep._id, { stepStatus: EStepStatus.CANCELLED }, { session })
    }
  }

  if (_shipment.status !== EShipmentStatus.CANCELLED) {
    const _shipmentUpdateHistory = new UpdateHistoryModel({
      referenceId: _shipment,
      referenceType: 'Shipment',
      who: adminId,
      beforeUpdate: _shipment,
      afterUpdate: { ..._shipment, steps: [{ ...currentStep, stepStatus: EStepStatus.CANCELLED }] },
    })
    await _shipmentUpdateHistory.save({ session })
    await ShipmentModel.findByIdAndUpdate(
      _shipment,
      {
        status: EShipmentStatus.CANCELLED,
        $push: { history: _shipmentUpdateHistory },
      },
      { session },
    )
  }
}
