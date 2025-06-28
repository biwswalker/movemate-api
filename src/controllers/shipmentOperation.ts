import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import { FileInput } from '@inputs/file.input'
import DriverDetailModel from '@models/driverDetail.model'
import FileModel from '@models/file.model'
import BillingModel from '@models/finance/billing.model'
import { BillingReason } from '@models/finance/objects'
import PaymentModel from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'
import NotificationModel, { ENavigationType, ENotificationVarient } from '@models/notification.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'
import TransactionModel, {
  ERefType,
  ETransactionOwner,
  ETransactionStatus,
  ETransactionType,
} from '@models/transaction.model'
import UserModel from '@models/user.model'
import { VehicleType } from '@models/vehicleType.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { differenceInMinutes, format } from 'date-fns'
import { GraphQLError } from 'graphql'
import lodash, { filter, find, get, head, isArray, isEmpty, isEqual, last, reduce, sortBy, sum, tail } from 'lodash'
import { ClientSession } from 'mongoose'
import { getNewAllAvailableShipmentForDriver } from './shipmentGet'
import { initialStepDefinition } from './steps'
import { EUserRole } from '@enums/users'

Aigle.mixin(lodash, {})

export async function addStep(shipmentId: string, data: StepDefinition, session?: ClientSession): Promise<boolean> {
  const shipment = await ShipmentModel.findById(shipmentId)
  let newStep = []
  await Aigle.forEach(shipment?.steps, async (step, index: number) => {
    const currentStepId = get(step, '_id', '')
    if (index < data.seq) {
      newStep.push(currentStepId)
    } else if (data.seq === index) {
      const newStap = new StepDefinitionModel(data)
      await newStap.save({ session })
      newStep.push(newStap._id)
      if (currentStepId) {
        const newSeq = index + 1
        await StepDefinitionModel.findByIdAndUpdate(currentStepId, { seq: newSeq }, { session })
        newStep.push(currentStepId)
      }
    } else if (index > data.seq) {
      if (currentStepId) {
        const newSeq = index + 1
        await StepDefinitionModel.findByIdAndUpdate(currentStepId, { seq: newSeq }, { session })
        newStep.push(currentStepId)
      }
    }
  })
  await ShipmentModel.findByIdAndUpdate(shipment?._id, { steps: newStep }, { session })
  return true
}

export async function removeStep(
  shipmentId: string,
  stepIndex: number,
  session?: ClientSession,
): Promise<StepDefinition[]> {
  const shipment = await ShipmentModel.findById(shipmentId)
  const removeStep = get(shipment?.steps, stepIndex, undefined) as StepDefinition | undefined
  if (removeStep) {
    let newStep = []
    await Aigle.forEach(shipment?.steps, async (step, index: number) => {
      const currentStepId = get(step, '_id', '')
      if (index < stepIndex) {
        newStep.push(currentStepId)
      } else if (stepIndex === index) {
        // Skip
      } else if (index > stepIndex) {
        if (currentStepId) {
          const newSeq = index - 1
          await StepDefinitionModel.findByIdAndUpdate(currentStepId, { seq: newSeq }, { session })
          newStep.push(currentStepId)
        }
      }
    })
    await StepDefinitionModel.findByIdAndDelete(removeStep._id, { session })
    const _newShipment = await ShipmentModel.findByIdAndUpdate(
      shipment?._id,
      { steps: newStep },
      { session, new: true },
    )
    return (_newShipment.steps || []) as StepDefinition[]
  }
  return []
}

export async function replaceStep(
  shipmentId: string,
  replaceStep: StepDefinition,
  session?: ClientSession,
): Promise<StepDefinition[]> {
  const _shipment = await ShipmentModel.findById(shipmentId).session(session).exec()
  const oldStep = find(_shipment?.steps, ['step', replaceStep.step]) as StepDefinition | undefined
  if (oldStep) {
    const _newStep = new StepDefinitionModel(replaceStep)
    await _newStep.save({ session })
    _shipment.steps[replaceStep.step] = _newStep
    await _shipment.save({ session })
    await StepDefinitionModel.findByIdAndDelete(oldStep._id, { session })
    const _newSteps = await ShipmentModel.findById(shipmentId).distinct('steps')
    return _newSteps as StepDefinition[]
  }
  return _shipment.steps as StepDefinition[]
}

export async function nextStep(shipmentId: string, images?: FileInput[], session?: ClientSession): Promise<boolean> {
  const shipment = await ShipmentModel.findById(shipmentId)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const uploadedFiles = await Aigle.map(images, async (image) => {
    const fileModel = new FileModel(image)
    await fileModel.save()
    const file = await FileModel.findById(fileModel._id)
    return file
  })

  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
  await stepDefinitionModel.updateOne(
    {
      stepStatus: EStepStatus.DONE,
      images: uploadedFiles,
      updatedAt: new Date(),
    },
    { session },
  )
  const nextStepDeifinition = find(shipment?.steps, ['seq', shipment?.currentStepSeq + 1])
  const nextStepId = get(nextStepDeifinition, '_id', '')
  if (nextStepId) {
    const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)
    await nextStepDefinitionModel.updateOne({ stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() }, { session })
    await ShipmentModel.findByIdAndUpdate(shipment?._id, { currentStepSeq: nextStepDefinitionModel.seq }, { session })
    return true
  }
  return false
}

export async function podSent(
  shipmentId: string,
  images: FileInput[],
  trackingNumber: string,
  provider: string,
  session?: ClientSession,
): Promise<boolean> {
  const shipment = await ShipmentModel.findById(shipmentId)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const uploadedFiles = await Aigle.map(images, async (image) => {
    const fileModel = new FileModel(image)
    await fileModel.save()
    const file = await FileModel.findById(fileModel._id)
    return file
  })
  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
  if (stepDefinitionModel.step === EStepDefinition.POD) {
    await stepDefinitionModel.updateOne(
      {
        stepStatus: EStepStatus.DONE,
        images: uploadedFiles,
        updatedAt: new Date(),
      },
      { session },
    )
    const nextStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq + 1])
    const nextStepId = get(nextStep, '_id', '')
    const shipmentModel = await ShipmentModel.findById(shipment?._id)
    if (nextStepId) {
      const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId)
      await nextStepDefinitionModel.updateOne(
        { stepStatus: EStepStatus.PROGRESSING, updatedAt: new Date() },
        { session },
      )
      await shipmentModel.updateOne(
        {
          currentStepSeq: nextStepDefinitionModel.seq,
          podDetail: Object.assign(shipmentModel.podDetail, { trackingNumber, provider }),
        },
        { session },
      )
    } else {
      await shipmentModel.updateOne(
        {
          podDetail: Object.assign(shipmentModel.podDetail, { trackingNumber, provider }),
        },
        { session },
      )
    }
    return true
  } else {
    const message = 'ยังไม่ถึงขึ้นตอนการส่ง POD'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.SHIPMENT_NOT_FINISH, errors: [{ message }] },
    })
  }
}

export async function finishJob(shipmentId: string, session?: ClientSession): Promise<boolean> {
  const shipment = await ShipmentModel.findById(shipmentId)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', ''))
  const currentDate = new Date()
  if (stepDefinitionModel.step === EStepDefinition.FINISH) {
    await stepDefinitionModel.updateOne(
      {
        stepStatus: EStepStatus.DONE,
        customerMessage: 'ดำเนินการเสร็จสิ้น',
        driverMessage: 'ดำเนินการเสร็จสิ้น',
        updatedAt: currentDate,
      },
      { session },
    )
    await ShipmentModel.findByIdAndUpdate(
      shipment?._id,
      {
        currentStepSeq: stepDefinitionModel.seq,
        status: EShipmentStatus.DELIVERED,
        deliveredDate: currentDate,
      },
      { session },
    )

    const pickup = head(shipment?.destinations)
    const dropoffs = tail(shipment?.destinations)
    const description = `${shipment?.trackingNumber} ค่าขนส่งจาก ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
      '',
    )}`

    /**
     * TRANSACTIONS
     * Calculate WHT 1% for driver here
     */
    const lastPayment = last(sortBy(shipment?.quotations, ['createdAt'])) as Quotation
    const cost = lastPayment?.cost
    const isAgentDriver = !isEmpty(shipment?.agentDriver)
    const ownerDriverId = isAgentDriver ? get(shipment, 'agentDriver._id', '') : get(shipment, 'driver._id', '')

    const driver = await UserModel.findById(ownerDriverId)
    if (isAgentDriver && get(this, 'driver._id', '')) {
      /**
       * Update employee transaction
       */
      const employeeTransaction = new TransactionModel({
        amountTax: 0, // WHT
        amountBeforeTax: 0,
        amount: 0,
        ownerId: get(this, 'driver._id', ''),
        ownerType: ETransactionOwner.BUSINESS_DRIVER,
        description: `${shipment?.trackingNumber} งานจาก ${driver.fullname}`,
        refId: shipment?._id,
        refType: ERefType.SHIPMENT,
        transactionType: ETransactionType.INCOME,
        status: ETransactionStatus.COMPLETE,
      })
      await employeeTransaction.save({ session })
    }
    /**
     * Add transaction for shipment driver owner
     */
    const driverTransaction = new TransactionModel({
      amountTax: cost.tax, // WHT
      amountBeforeTax: cost.subTotal,
      amount: cost.total,
      ownerId: ownerDriverId,
      ownerType: ETransactionOwner.DRIVER,
      description: description,
      refId: shipment?._id,
      refType: ERefType.SHIPMENT,
      transactionType: ETransactionType.INCOME,
      status: ETransactionStatus.PENDING,
    })
    await driverTransaction.save({ session })

    /**
     * Add transaction for Movemate Thailand
     */
    // const movemateTransaction = new TransactionModel({
    //   amount: amountPrice,
    //   ownerId: MOVEMATE_OWNER_ID,
    //   ownerType: ETransactionOwner.MOVEMATE,
    //   description: description,
    //   refId: shipment?._id,
    //   refType: ERefType.SHIPMENT,
    //   transactionType: ETransactionType.INCOME,
    //   status: ETransactionStatus.COMPLETE,
    // })
    // await movemateTransaction.save({ session })

    // Update balance
    if (driver) {
      const driverDetail = await DriverDetailModel.findById(driver.driverDetail)
      await driverDetail.updateBalance(session)
    }

    /**
     * Notification
     */
    const _customerId = get(shipment, 'customer._id', '')
    await NotificationModel.sendNotification({
      userId: _customerId,
      varient: ENotificationVarient.SUCCESS,
      title: 'งานขนส่งสำเร็จ',
      message: [
        `เราขอประกาศด้วยความยินดีว่าการขนส่งเลขที่ ${shipment?.trackingNumber} ของท่านได้เสร็จสมบูรณ์!`,
        `สินค้าของท่านถูกนำส่งไปยังปลายทางเรียบร้อยแล้ว`,
      ],
      infoText: 'ดูสรุปการจองและค่าใช้จ่าย',
      infoLink: `/main/tracking?tracking_number=${shipment?.trackingNumber}`,
    })

    return true
  } else {
    const message = 'ยังไม่ถึงขึ้นตอนการจบงาน'
    throw new GraphQLError(message, {
      extensions: { code: REPONSE_NAME.SHIPMENT_NOT_FINISH, errors: [{ message }] },
    })
  }
}

interface CancelledShipmentInput {
  shipmentId: string
  reason: string
}

export async function cancelledShipment(input: CancelledShipmentInput, userId: string, session?: ClientSession) {
  const { shipmentId, reason } = input
  const _shipment = await ShipmentModel.findOne({ _id: shipmentId }).session(session)
  if (!_shipment) {
    const message = 'ไม่สามารถหาข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  const isCredit = _shipment.paymentMethod === EPaymentMethod.CREDIT

  const latestQuotation = last(sortBy(_shipment.quotations, ['createdAt'])) as Quotation | undefined
  if (!latestQuotation) {
    const message = 'ไม่พบราคางานขนส่ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  const _latestPayment = isCredit
    ? undefined
    : await PaymentModel.findOne({ quotations: { $in: [latestQuotation._id] } }).session(session)

  const today = new Date()

  const isDriverAccepted = _shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.ACCEPTED && _shipment.driver
  const isCompletePayment = isCredit ? true : _latestPayment?.status === EPaymentStatus.COMPLETE
  const { description, forCustomer, forDriver } = calculateCancelledRefundPrice(_shipment, isCompletePayment)

  /**
   * Update step definition
   */
  const currentStep = find(_shipment.steps, ['seq', _shipment.currentStepSeq]) as StepDefinition | undefined
  const lastStep = last(sortBy(_shipment.steps, ['seq'])) as StepDefinition

  const deniedSteps = filter(_shipment.steps as StepDefinition[], (step) => step.seq >= currentStep.seq)
  await Aigle.forEach(deniedSteps, async (step) => {
    await StepDefinitionModel.findByIdAndUpdate(step._id, { stepStatus: EStepStatus.CANCELLED }, { session })
  })
  /**
   * New Step
   */
  let stepIds = []
  let _newLatestSeq = lastStep.seq + 1
  const _customerCancelledStep = new StepDefinitionModel({
    step: EStepDefinition.CUSTOMER_CANCELLED,
    seq: _newLatestSeq,
    stepName: EStepDefinitionName.CUSTOMER_CANCELLED,
    customerMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
    driverMessage: EStepDefinitionName.CUSTOMER_CANCELLED,
    stepStatus: EStepStatus.DONE,
  })
  await _customerCancelledStep.save({ session })
  stepIds.push(_customerCancelledStep._id)
  if (!isCredit) {
    // Add refund step
    _newLatestSeq = lastStep.seq + 2
    const refundStep = new StepDefinitionModel({
      step: EStepDefinition.REFUND,
      seq: _newLatestSeq,
      stepName: EStepDefinitionName.REFUND,
      customerMessage: EStepDefinitionName.REFUND,
      driverMessage: EStepDefinitionName.REFUND,
      stepStatus: EStepStatus.PROGRESSING,
    })
    await refundStep.save({ session })
    stepIds.push(refundStep._id)
  }

  if (!isCredit) {
    /**
     * Cash
     * Cancelled Payment ล่าสุดหากยังไม่ได้ดำเนินการ
     * สร้าง Payment refund ใหม่ ยอดใหม่
     */
    // Add Payment refund
    const generateMonth = format(today, 'yyMM')
    const _paymentNumber = await generateTrackingNumber(`PREFU${generateMonth}`, 'payment', 3)
    const _refund = new PaymentModel({
      quotations: [latestQuotation?._id],
      paymentMethod: EPaymentMethod.CASH,
      paymentNumber: _paymentNumber,
      status: EPaymentStatus.PENDING,
      type: EPaymentType.REFUND,
      tax: 0,
      total: forCustomer,
      subTotal: forCustomer,
    })
    await _refund.save({ session })
    // If Latest Payment is not complete; cancelled it
    if (!isCompletePayment) {
      await PaymentModel.findByIdAndUpdate(_latestPayment._id, { status: EPaymentStatus.CANCELLED })
    }
    // Update billing
    const refundReason: BillingReason = {
      detail: description,
      type: EBillingReason.CANCELLED_SHIPMENT,
    }
    await BillingModel.findOneAndUpdate(
      { payments: { $in: [_latestPayment._id] }, shipments: { $in: [_shipment._id] } },
      {
        status: EBillingStatus.PENDING,
        state: EBillingState.REFUND,
        $push: { payments: _refund, reasons: refundReason },
      },
    )
  }

  /**
   * Update Shipment
   */
  const _updatedShipment = await ShipmentModel.findByIdAndUpdate(
    _shipment._id,
    {
      status: isCredit ? EShipmentStatus.CANCELLED : EShipmentStatus.REFUND,
      cancellationReason: reason,
      cancelledDate: today,
      currentStepSeq: _newLatestSeq,
      $push: { steps: stepIds },
    },
    { session },
  )

  const updatedBy = await UserModel.findById(userId)
  const isCancelledByAdmin = updatedBy.userRole === EUserRole.ADMIN

  /**
   * เพิ่ม Transaction ของ driver
   */
  if (isDriverAccepted && _shipment.driver) {
    const driverId = get(_updatedShipment, 'driver._id', '')
    const driverSubtotal = forDriver
    const driverTax = driverSubtotal * 0.01
    const driverTotal = sum([driverSubtotal, -driverTax])
    const driverTransaction = new TransactionModel({
      amountTax: driverTax, // WHT
      amountBeforeTax: driverSubtotal,
      amount: driverTotal,
      ownerId: driverId,
      ownerType: ETransactionOwner.DRIVER,
      description: description,
      refId: _shipment._id,
      refType: ERefType.SHIPMENT,
      transactionType: ETransactionType.INCOME,
      status: ETransactionStatus.PENDING,
    })
    await driverTransaction.save({ session })

    // Driver Notification
    await NotificationModel.sendNotification(
      {
        userId: driverId,
        varient: ENotificationVarient.ERROR,
        title: 'งานขนส่งของท่านถูกยกเลิก',
        message: [
          `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${_shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดย${
            isCancelledByAdmin ? 'ผู้ดูแลระบบ' : 'ลูกค้า'
          } เหตุผล: ${reason}`,
          `กรุณาตรวจสอบรายละเอียดงานขนส่งของท่าน`,
        ],
      },
      session,
      true,
      { navigation: ENavigationType.SHIPMENT, trackingNumber: _shipment.trackingNumber },
    )
  }

  await NotificationModel.sendNotification(
    {
      userId: get(_shipment, 'customer._id', ''),
      varient: ENotificationVarient.ERROR,
      title: 'การจองของท่านถูกยกเลิกแล้ว',
      message: [
        `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${_shipment.trackingNumber} ของท่านได้ยกเลิกแล้วโดย${
          isCancelledByAdmin ? 'ผู้ดูแลระบบ' : 'ท่านเอง'
        }`,
        ...(!isCredit ? ['ระบบกำลังคำนวนยอดคืนเงิน และจะดำเนินการคืนให้ท่านในไม่ช้า'] : []),
      ],
      infoText: 'ดูงานขนส่ง',
      infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
    },
    session,
  )

  await NotificationModel.sendNotificationToAdmins(
    {
      varient: ENotificationVarient.ERROR,
      title: 'งานขนส่งถูกยกเลิก',
      message: [
        `การจองหมายเลข ${_shipment.trackingNumber} ถูกยกเลิกโดย ${
          isCancelledByAdmin ? updatedBy.fullname : 'ลูกค้า'
        } เหตุผล: ${reason}`,
      ],
    },
    session,
  )

  const newShipments = await getNewAllAvailableShipmentForDriver()
  await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
  console.log(`Shipment ${shipmentId} is cancelled.`)
}

function calculateCancelledRefundPrice(_shipment: Shipment, isCompletePayment: boolean) {
  const today = new Date()

  const latestQuotation = last(sortBy(_shipment.quotations, ['createdAt'])) as Quotation | undefined
  if (!latestQuotation) {
    const message = 'ไม่พบราคางานขนส่ง'
    throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
  }

  /**
   * หาก Quotation ล่าสุดยังไม่ได้ดำเนินการ
   * ราคาล่าสุด - (ราคาเพิ่มเติม)
   * total - (acturePrice)
   * - หากราคาเพิ่มเติมติดลบอยู่แล้วต้องลบอีกเช่น total = 1500, acture = -500
   * ตามสูตร: 1500 - (-500) = 2000
   */
  const { total: totalCost, acturePrice: acturePriceCost } = latestQuotation.cost
  const totalPayCost = sum([totalCost, -(isCompletePayment ? 0 : acturePriceCost)])
  const { total: totalPrice, acturePrice } = latestQuotation.price
  const totalPayPrice = sum([totalPrice, -(isCompletePayment ? 0 : acturePrice)])

  const _vehicle = _shipment.vehicleId as VehicleType
  const differenceTime = differenceInMinutes(today, _shipment.bookingDateTime)

  const urgentCancellingTime = isEqual(_vehicle.type, '4W') ? 40 : 90
  const middleCancellingTime = isEqual(_vehicle.type, '4W') ? 120 : 180
  if (differenceTime <= urgentCancellingTime) {
    /**
     * Customer refund: 0% (คิดค่าใช้จ่ายลูกค้า 100%)
     * Driver refund: 100%
     */
    return {
      forDriver: totalPayCost,
      forCustomer: 0,
      description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${urgentCancellingTime} นาที`,
    }
  } else if (differenceTime > urgentCancellingTime && differenceTime <= middleCancellingTime) {
    /**
     * Customer refund: 50% (คิดค่าใช้จ่ายลูกค้า 50%)
     * Driver refund: 50%
     */
    const _percent = 0.5
    return {
      forDriver: _percent * totalPayCost,
      forCustomer: _percent * totalPayPrice,
      description: `ผู้ใช้ยกเลิกงานขนส่งก่อนเวลาน้อยกว่า ${middleCancellingTime} นาที`,
    }
  } else {
    /**
     * Customer refund: 100% (คิดค่าใช้จ่ายลูกค้า 0%)
     * Driver refund: 0%
     */
    return {
      forDriver: 0,
      forCustomer: totalPayPrice,
      description: `ผู้ใช้ยกเลิกงานขนส่ง`,
    }
  }
}

interface CancelledShipmentInput {
  shipmentId: string
  reason: string
}

export async function driverCancelledShipment(input: CancelledShipmentInput, session?: ClientSession) {
  const { shipmentId, reason } = input
  const today = new Date()

  const _shipment = await ShipmentModel.findByIdAndUpdate(
    shipmentId,
    {
      status: EShipmentStatus.IDLE,
      driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
      driver: undefined,
      cancellationReason: reason,
      cancelledDate: today,
      currentStepSeq: 0,
      steps: [],
    },
    { session },
  )
  await initialStepDefinition(shipmentId, true, session)

  await NotificationModel.sendNotificationToAdmins(
    {
      varient: ENotificationVarient.WRANING,
      title: 'คนขับยกเลิกงาน!',
      message: [`คนขับได้ยกเลิกงานขนส่งหมายเลข '${_shipment.trackingNumber}' กรุณาจัดหาคนขับใหม่หรือดำเนินการแก้ไข`],
      infoText: 'ดูรายละเอียดงาน',
      infoLink: `/general/shipments/${_shipment.trackingNumber}`,
    },
    session,
  )

  await NotificationModel.sendNotification(
    {
      userId: _shipment.customer.toString(),
      varient: ENotificationVarient.WRANING,
      title: 'คนขับยกเลิกการจัดส่ง',
      message: [`งานขนส่งหมายเลข ${_shipment.trackingNumber} ของคุณถูกยกเลิกโดยคนขับ`, `ระบบกำลังจัดหาคนขับใหม่ให้คุณ`],
    },
    session,
  )

  /**
   * Add check remaining time is enough to get no
   * Add to JOB notification
   * TODO
   */

  /**
   * Add Transaction for driver for history
   */
}
