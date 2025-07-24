import { EPaymentMethod } from '@enums/payments'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import { FileInput } from '@inputs/file.input'
import DriverDetailModel from '@models/driverDetail.model'
import FileModel from '@models/file.model'
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
import UserModel, { User } from '@models/user.model'
import { VehicleType } from '@models/vehicleType.model'
import Aigle from 'aigle'
import { REPONSE_NAME } from 'constants/status'
import { differenceInMinutes } from 'date-fns'
import { GraphQLError } from 'graphql'
import lodash, { filter, find, get, head, includes, isEmpty, isEqual, last, map, reduce, sortBy, tail } from 'lodash'
import { ClientSession } from 'mongoose'
import { CancellationPolicyDetail, CancellationPreview } from '@payloads/cancellation.payload'
import { fDateTime } from '@utils/formatTime'
import { clearShipmentJobQueues } from './shipmentJobQueue'
import { publishDriverMatchingShipment } from './shipmentGet'

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
  const shipment = await ShipmentModel.findById(shipmentId).session(session)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const uploadedFiles = await Aigle.map(images, async (image) => {
    const fileModel = new FileModel(image)
    await fileModel.save({ session })
    const file = await FileModel.findById(fileModel._id).session(session)
    return file
  })

  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', '')).session(session)
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
    const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId).session(session)
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
  const shipment = await ShipmentModel.findById(shipmentId).session(session)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const uploadedFiles = await Aigle.map(images, async (image) => {
    const fileModel = new FileModel(image)
    await fileModel.save({ session })
    const file = await FileModel.findById(fileModel._id).session(session)
    return file
  })
  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', '')).session(session)
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
    const shipmentModel = await ShipmentModel.findById(shipment?._id).session(session)
    if (nextStepId) {
      const nextStepDefinitionModel = await StepDefinitionModel.findById(nextStepId).session(session)
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
  const shipment = await ShipmentModel.findById(shipmentId).session(session)
  const currentStep = find(shipment?.steps, ['seq', shipment?.currentStepSeq])
  const stepDefinitionModel = await StepDefinitionModel.findById(get(currentStep, '_id', '')).session(session)
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
    const description = `ค่าขนส่ง #${shipment?.trackingNumber} ค่าขนส่งจาก ${pickup.name} ไปยัง ${reduce(
      dropoffs,
      (prev, curr) => (prev ? `${prev}, ${curr.name}` : curr.name),
      '',
    )}`

    /**
     * TRANSACTIONS
     * Calculate WHT 1% for driver here
     */
    // ตรวจสอบว่ามี transaction จากการ finish job นี้แล้วหรือยัง
    const existingFinishTransaction = await TransactionModel.findOne({
      refId: shipment?._id,
      refType: ERefType.SHIPMENT,
      transactionType: ETransactionType.INCOME, // ตรวจสอบเฉพาะรายรับที่เกิดจากการจบงาน
    }).session(session)

    if (existingFinishTransaction) {
      console.warn(`[finishJob] Transaction for shipment ${shipmentId} already exists. Skipping creation.`)
      // อาจจะคืนค่า true ไปเลย เพราะถือว่าจบงานสำเร็จแล้ว แต่ transaction ถูกสร้างไปก่อนหน้า
      return true
    }

    const lastPayment = last(sortBy(shipment?.quotations, ['createdAt'])) as Quotation
    const cost = lastPayment?.cost
    const isAgentDriver = !isEmpty(shipment?.agentDriver)
    const ownerDriverId = isAgentDriver ? get(shipment, 'agentDriver._id', '') : get(shipment, 'driver._id', '')

    const driver = await UserModel.findById(ownerDriverId).session(session)

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
     * Update driver balance
     */
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

/**
 * Revert Rejected Shipment
 * @param shipmentId
 * @param adminId
 * @param session
 * @returns
 */
export async function revertShipmentRejection(
  shipmentId: string,
  adminId: string,
  session?: ClientSession,
): Promise<void> {
  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!_shipment || _shipment.status !== EShipmentStatus.REFUND) {
    // ไม่ต้องทำอะไรถ้า Shipment ไม่ได้อยู่ในสถานะคืนเงิน
    return
  }

  const originalSteps = _shipment.steps as StepDefinition[]

  // 1. ค้นหาและลบ Step ที่เกิดขึ้นหลังจากการปฏิเสธ (REJECTED_PAYMENT, REFUND)
  const stepsToRemove = filter(originalSteps, (step) => includes([EStepDefinition.REFUND], step.step))
  const stepIdsToRemove = map(stepsToRemove, '_id')

  // 2. ค้นหา Step การตรวจสอบการชำระเงิน (REJECTED_PAYMENT) เพื่อเปลี่ยนสถานะ
  const rejectedPaymentStep = find(originalSteps, { step: EStepDefinition.REJECTED_PAYMENT })

  if (!rejectedPaymentStep) {
    // กรณีที่ไม่เจอ step cash_verify ซึ่งไม่น่าเกิดขึ้น
    throw new GraphQLError('ไม่พบขั้นตอนการยืนยันการชำระเงินในงานนี้')
  }

  // 3. อัปเดตสถานะของ Step "CASH_VERIFY" ให้กลับมาเป็น "กำลังดำเนินการ"
  await StepDefinitionModel.findByIdAndUpdate(
    rejectedPaymentStep._id,
    {
      step: EStepDefinition.CASH_VERIFY,
      stepStatus: EStepStatus.PROGRESSING,
      stepName: EStepDefinitionName.CASH_VERIFY,
      customerMessage: 'ยืนยันการชำระเงิน',
      driverMessage: '',
    },
    { session },
  )

  // 4. สร้าง Array ของ Steps ใหม่โดยไม่มี Step ที่ถูกลบ idToRemove.equals(step._id)
  const newSteps = filter(originalSteps, (step) => !stepIdsToRemove.some((idToRemove) => isEqual(idToRemove, step._id)))
  const stepsIds = map(newSteps, '_id')

  // 5. อัปเดต Shipment ให้กลับไปสู่สถานะ "รอเริ่มงาน" และสถานะย่อยเป็น "รอตรวจสอบการชำระ"
  await ShipmentModel.findByIdAndUpdate(
    shipmentId,
    {
      status: EShipmentStatus.IDLE,
      adminAcceptanceStatus: EAdminAcceptanceStatus.PENDING, // สำคัญมาก: ต้องกลับมารอ Admin approve ใหม่
      driverAcceptanceStatus: EDriverAcceptanceStatus.IDLE,
      currentStepSeq: rejectedPaymentStep.seq, // ตั้งค่าให้ Step ปัจจุบันกลับมาที่การตรวจสอบสลิป
      steps: map(newSteps, '_id'), // อัปเดต Array ของ Step IDs
      cancellationReason: undefined,
      cancellationDetail: undefined,
      cancelledDate: undefined,
    },
    { session },
  )

  // 7. เปลี่ยน สถานะ step CANCELLED เป็น IDLE
  await StepDefinitionModel.updateMany(
    { _id: { $in: stepsIds }, stepStatus: EStepStatus.CANCELLED },
    { stepStatus: EStepStatus.IDLE },
    { session },
  )

  // 6. ลบ step ที่ไม่ต้องการออกจาก collection
  await StepDefinitionModel.deleteMany({ _id: { $in: stepIdsToRemove } }, { session })
}

/**
 * CANCELLATION PREVIEW
 * @param shipmentId
 * @returns
 */
export async function getShipmentCancellationPreview(shipmentId: string): Promise<CancellationPreview> {
  const shipment = await ShipmentModel.findById(shipmentId).populate('vehicleId')
  if (!shipment) {
    throw new GraphQLError('ไม่พบข้อมูลงานขนส่ง')
  }

  const latestQuotation = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined
  if (!latestQuotation) {
    throw new GraphQLError('ไม่พบข้อมูลใบเสนอราคา')
  }

  const vehicle = shipment.vehicleId as VehicleType
  const isFourWheeler = vehicle.type === '4W'
  const cancellationTime = new Date()
  const minutesToBooking = differenceInMinutes(shipment.bookingDateTime, cancellationTime)

  // --- กำหนดเงื่อนไขและนโยบาย ---
  const policy: CancellationPolicyDetail[] = isFourWheeler
    ? [
        { condition: 'ยกเลิกก่อนเริ่มงานมากกว่า 120 นาที', feeDescription: 'ไม่มีค่าใช้จ่าย' },
        { condition: 'ยกเลิกระหว่าง 40 - 120 นาที', feeDescription: 'คิดค่าใช้จ่าย 50%' },
        { condition: 'ยกเลิกน้อยกว่า 40 นาที', feeDescription: 'คิดค่าใช้จ่าย 100%' },
      ]
    : [
        { condition: 'ยกเลิกก่อนเริ่มงานมากกว่า 180 นาที', feeDescription: 'ไม่มีค่าใช้จ่าย' },
        { condition: 'ยกเลิกระหว่าง 90 - 180 นาที', feeDescription: 'คิดค่าใช้จ่าย 50%' },
        { condition: 'ยกเลิกน้อยกว่า 90 นาที', feeDescription: 'คิดค่าใช้จ่าย 100%' },
      ]

  // --- คำนวณค่าปรับและยอดคืนตามเงื่อนไขปัจจุบัน ---
  const pickupStep = find(shipment.steps, ['step', EStepDefinition.PICKUP]) as StepDefinition | undefined
  const isDonePickup = pickupStep && pickupStep.stepStatus === EStepStatus.DONE

  const freeThreshold = isFourWheeler ? 120 : 180
  const halfChargeThreshold = isFourWheeler ? 40 : 90
  const totalCharge = latestQuotation.price.total

  let cancellationFee = 0
  let finalChargeDescription = ''

  if (
    !shipment.driver &&
    includes(
      [EDriverAcceptanceStatus.IDLE, EDriverAcceptanceStatus.PENDING, EDriverAcceptanceStatus.UNINTERESTED],
      shipment.driverAcceptanceStatus,
    )
  ) {
    cancellationFee = 0
    finalChargeDescription = 'คุณอยู่ในเงื่อนไขยกเลิกฟรี ไม่มีค่าใช้จ่าย ตามเงื่อนไข'
  } else if (isDonePickup) {
    cancellationFee = totalCharge
    finalChargeDescription = 'คุณจะถูกคิดค่าใช้จ่ายเต็มจำนวน 100% ตามเงื่อนไข'
  } else if (minutesToBooking > freeThreshold) {
    cancellationFee = 0
    finalChargeDescription = 'คุณอยู่ในเงื่อนไขยกเลิกฟรี ไม่มีค่าใช้จ่าย ตามเงื่อนไข'
  } else if (minutesToBooking > halfChargeThreshold) {
    cancellationFee = totalCharge * 0.5
    finalChargeDescription = 'คุณจะถูกคิดค่าใช้จ่าย 50% ของค่าขนส่ง ตามเงื่อนไข'
  } else {
    cancellationFee = totalCharge
    finalChargeDescription = 'คุณจะถูกคิดค่าใช้จ่ายเต็มจำนวน 100% ตามเงื่อนไข'
  }

  // สำหรับงานเงินสดที่จ่ายแล้ว ต้องคำนวณยอดคืน
  // สมมติว่าถ้าจ่ายเงินสดคือจ่ายเต็มจำนวนแล้ว
  const refundAmount = shipment.paymentMethod === EPaymentMethod.CASH ? Math.max(0, totalCharge - cancellationFee) : 0 // งานเครดิตไม่มีการคืนเงินสด แต่จะปรับยอดในบิล

  return {
    cancellationFee: cancellationFee,
    refundAmount: refundAmount,
    finalChargeDescription: finalChargeDescription,
    policyDetails: policy,
    isAllowed: true, // ในตัวอย่างนี้อนุญาตให้ยกเลิกได้เสมอ (สามารถเพิ่มเงื่อนไขตรวจสอบ Step ได้)
    reasonIfNotAllowed: null,
  }
}

/**
 * Controller สำหรับจัดการการเปลี่ยนแปลงเวลาเริ่มงาน (bookingDateTime)
 * @param shipmentId ID ของงานขนส่ง
 * @param newBookingDateTime วันและเวลาเริ่มงานใหม่
 * @param modifiedBy ID ของผู้ที่ทำการแก้ไข
 * @param session Transaction Session
 */
export async function handleUpdateBookingTime(
  shipmentId: string,
  newBookingDateTime: Date,
  modifiedBy: string,
  session?: ClientSession,
): Promise<Shipment> {
  const shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!shipment) {
    throw new GraphQLError('ไม่พบข้อมูลงานขนส่ง')
  }

  const oldBookingDateTime = shipment.bookingDateTime

  // --- อัปเดตเวลาในฐานข้อมูลก่อน ---
  shipment.bookingDateTime = newBookingDateTime

  // เพิ่มประวัติการแก้ไข
  shipment.modifieds.push({
    modifiedBy,
    createdAt: new Date(),
    reason: `เปลี่ยนแปลงเวลาเริ่มงานจาก ${fDateTime(oldBookingDateTime)} เป็น ${fDateTime(newBookingDateTime)}`,
  })

  await shipment.save({ session })

  // --- ตรวจสอบสถานะและจัดการ Logic การแจ้งเตือน ---
  if (shipment.driver && shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.ACCEPTED) {
    // ** กรณีที่ 1: มีคนขับรับงานแล้ว **
    // แจ้งเตือนคนขับและลูกค้าโดยตรง
    const driver = shipment.driver as User
    const customer = shipment.customer as User

    // แจ้งเตือนคนขับที่รับงาน
    await NotificationModel.sendNotification(
      {
        userId: driver._id,
        varient: ENotificationVarient.INFO,
        title: 'มีการเปลี่ยนแปลงเวลาเริ่มงาน',
        message: [`งาน #${shipment.trackingNumber} ได้เปลี่ยนเวลาเริ่มงานเป็น ${fDateTime(newBookingDateTime)}`],
      },
      session,
      true,
      { navigation: ENavigationType.SHIPMENT, trackingNumber: shipment.trackingNumber },
    )

    // แจ้งเตือนลูกค้า
    await NotificationModel.sendNotification(
      {
        userId: customer._id,
        varient: ENotificationVarient.INFO,
        title: 'มีการเปลี่ยนแปลงเวลาเริ่มงาน',
        message: [`งานของคุณ #${shipment.trackingNumber} ได้เปลี่ยนเวลาเริ่มงานเป็น ${fDateTime(newBookingDateTime)}`],
        infoLink: `/main/tracking?tracking_number=${shipment.trackingNumber}`,
      },
      session,
    )

    console.log(`Booking time updated for accepted shipment ${shipmentId}. Notified driver and customer.`)
  } else {
    // ** กรณีที่ 2: ยังไม่มีคนขับรับงาน **
    // 1. เคลียร์ Job เก่าใน Queue เพื่อป้องกันการแจ้งเตือนซ้ำซ้อน
    await clearShipmentJobQueues(shipmentId)

    // 2. ประกาศหางานใหม่ (เหมือนการสร้างงานใหม่)
    await publishDriverMatchingShipment(undefined, session)

    // (Optional) อาจจะเรียก shipmentNotify(shipmentId) โดยตรงก็ได้ หากต้องการให้งานนี้ถูก Notify ทันที
    // await shipmentNotify(shipmentId);

    console.log(`Booking time updated for pending shipment ${shipmentId}. Queues cleared and re-notified.`)
  }

  return shipment
}
