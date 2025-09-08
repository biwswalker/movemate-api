import { DestinationInput, ShipmentInput } from '@inputs/shipment.input'
import UserModel, { User } from '@models/user.model'
import VehicleTypeModel from '@models/vehicleType.model'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation, ClientSession, Types } from 'mongoose'
import lodash, {
  filter,
  find,
  get,
  head,
  includes,
  isEqual,
  last,
  map,
  pick,
  range,
  reduce,
  sortBy,
  tail,
  values,
} from 'lodash'
import { Destination } from '@models/shipment/objects'
import { extractThaiAddress, getPlaceDetail } from '@services/maps/location'
import { calculateExistingQuotation, calculateQuotation } from './quotation'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { REPONSE_NAME } from 'constants/status'
import { EDriverStatus, EUserRole } from '@enums/users'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import ShipmentAdditionalServicePriceModel, {
  ShipmentAdditionalServicePrice,
} from '@models/shipmentAdditionalServicePrice.model'
import VehicleCostModel from '@models/vehicleCost.model'
import { DistanceCostPricing } from '@models/distanceCostPricing.model'
import PrivilegeModel from '@models/privilege.model'
import { FileInput } from '@inputs/file.input'
import FileModel from '@models/file.model'
import DirectionsResultModel from '@models/directionResult.model'
import { generateTrackingNumber } from '@utils/string.utils'
import { format } from 'date-fns'
import PaymentModel, { Payment } from '@models/finance/payment.model'
import { BillingReason } from '@models/finance/objects'
import QuotationModel, { Quotation } from '@models/finance/quotation.model'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EQuotationStatus, EShipmentStatus } from '@enums/shipments'
import BillingModel from '@models/finance/billing.model'
import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import ShipmentModel from '@models/shipment.model'
import { initialStepDefinition } from './steps'
import NotificationModel, { ENavigationType, ENotificationVarient } from '@models/notification.model'
import addEmailQueue from '@utils/email.utils'
import { UpdateShipmentInput } from '@inputs/booking.input'
import { fCurrency } from '@utils/formatNumber'
import { addCustomerCreditUsage } from './customer'
import PaymentEvidenceModel from '@models/finance/evidence.model'
import { AdditionalService } from '@models/additionalService.model'
import { VALUES } from 'constants/values'
import { addStep, removeStep } from './shipmentOperation'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
  StepDefinition,
} from '@models/shipmentStepDefinition.model'

Aigle.mixin(lodash, {})

export async function createShipment(data: ShipmentInput, customerId: string, session?: ClientSession) {
  const customer = await UserModel.findById(customerId).session(session) // Session
  if (!customer) {
    const message = 'ไม่สามารถหาข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
    throw new GraphQLError(message, {
      extensions: { code: 'NOT_FOUND', errors: [{ message }] },
    })
  }

  const vehicle = await VehicleTypeModel.findById(data.vehicleId).session(session).lean()
  if (!vehicle) {
    const message = 'ไม่สามารถหาข้อมูลประเภทรถ เนื่องจากไม่พบประเภทรถดังกล่าว'
    throw new GraphQLError(message, {
      extensions: { code: 'NOT_FOUND', errors: [{ message }] },
    })
  }

  /**
   * Favorit Driver
   */
  if (data.favoriteDriverId) {
    const favoriteDriver = await UserModel.findById(data.favoriteDriverId).lean()
    if (!favoriteDriver || favoriteDriver.userRole !== EUserRole.DRIVER) {
      const message = 'ไม่สามารถหาข้อมูลคนขับได้ เนื่องจากไม่พบคนขับดังกล่าว'
      throw new GraphQLError(message, {
        extensions: { code: 'NOT_FOUND', errors: [{ message }] },
      })
    }
    if (favoriteDriver.drivingStatus !== EDriverStatus.IDLE) {
      const message = 'พนักงานขนส่งคนโปรด กำลังดำเนินการขนส่งงานอื่นๆในระบบอยู่'
      throw new GraphQLError(message, {
        extensions: { code: REPONSE_NAME.DRIVER_CURRENTLY_WORKING, errors: [{ message }] },
      })
    }
  }

  const _destinations = await Aigle.map<DestinationInput, Destination>(data.locations, async (location) => {
    const { place } = await getPlaceDetail(location.placeId)
    const { province, district, subDistrict } = extractThaiAddress(place.addressComponents || [])
    return {
      ...location,
      placeDetail: place,
      placeProvince: province,
      placeDistrict: district,
      placeSubDistrict: subDistrict,
    }
  })

  const _quotationCalculation = await calculateQuotation(
    {
      isRounded: data.isRoundedReturn,
      locations: data.locations,
      vehicleTypeId: data.vehicleId,
      discountId: data.discountId,
      serviceIds: data.additionalServices,
    },
    customerId,
    session,
  )

  // const customerCreditPaymentId = get(customer, 'businessDetail.creditPayment._id', '')
  // const creditPaymentData = customerCreditPaymentId
  //   ? await BusinessCustomerCreditPaymentModel.findById(customerCreditPaymentId)
  //   : null

  /**
   * Additional Service
   */
  const serviceBulkOperations = await Aigle.map<string, AnyBulkWriteOperation>(
    data.additionalServices,
    async (serviceCostId) => {
      const serviceCost = await AdditionalServiceCostPricingModel.findById(serviceCostId).lean()
      return {
        insertOne: {
          document: {
            cost: serviceCost.cost,
            price: serviceCost.price,
            reference: serviceCost._id,
          },
        },
      }
    },
  )
  const serviceBulkResult = await ShipmentAdditionalServicePriceModel.bulkWrite(serviceBulkOperations, { session })
  const _additionalServices = values(serviceBulkResult.insertedIds)

  /**
   * Fomula
   */
  const vehicleCost = await VehicleCostModel.findByVehicleId(data.vehicleId, session)
  const _formula = vehicleCost.distance as DistanceCostPricing[]

  /**
   * Discount
   */
  let _discountId = null
  if (data.discountId) {
    const privilege = await PrivilegeModel.findOne({ _id: data.discountId }).session(session).lean()
    if (!privilege) {
      const message = 'ไม่สามารถหาข้อมูลส่วนลดได้ เนื่องจากไม่พบส่วนลดดังกล่าว'
      throw new GraphQLError(message, {
        extensions: { code: 'NOT_FOUND', errors: [{ message }] },
      })
    }
    if (privilege.limitAmout && privilege.limitAmout > 0) {
      const usedCount = await ShipmentModel.countDocuments({ discountId: privilege._id }).session(session)
      console.log('usedCount: ', usedCount)
      if (usedCount >= privilege.limitAmout) {
        throw new GraphQLError('โค้ดส่วนลดนี้ถูกใช้ครบจำนวนสิทธิ์แล้ว')
      }
    }

    if (privilege.limitPerUser && privilege.limitPerUser > 0) {
      const usedCount = await ShipmentModel.countDocuments({
        discountId: privilege._id,
        customer: customer._id,
      }).session(session)
      if (usedCount >= privilege.limitPerUser) {
        throw new GraphQLError('คุณได้ใช้โค้ดส่วนลดนี้ครบจำนวนครั้งที่กำหนดแล้ว')
      }
    }
    _discountId = privilege._id
    await PrivilegeModel.findByIdAndUpdate(privilege._id, { $push: { usedUser: customerId } }, { session })
  }

  /**
   * Additional Image
   */
  const additionalImagesBulkOperations = map<FileInput, AnyBulkWriteOperation>(data.additionalImage, (image) => ({
    insertOne: { document: image },
  }))
  const additionalImagesBulkResult = await FileModel.bulkWrite(additionalImagesBulkOperations, { session })
  const _additionalImages = values(additionalImagesBulkResult.insertedIds)

  /**
   * Map Direction
   */
  const _route = new DirectionsResultModel({ rawData: data.directionRoutes })
  await _route.save({ session })

  const today = new Date()
  const generateMonth = format(today, 'yyMM')
  const _quotationNumber = await generateTrackingNumber(`QU${generateMonth}`, 'quotation', 5)
  const _quotation = new QuotationModel({
    quotationNumber: _quotationNumber,
    quotationDate: today,
    price: _quotationCalculation.price,
    cost: _quotationCalculation.cost,
    detail: _quotationCalculation.detail,
    subTotal: _quotationCalculation.price.subTotal,
    tax: _quotationCalculation.price.tax,
    total: _quotationCalculation.price.total,
  })
  await _quotation.save({ session })

  /**
   * Generate: Tracking Number and Shipment ID
   */
  const _shipmentId = new Types.ObjectId()
  const _trackingNumber = await generateTrackingNumber('MMTH', 'tracking', 6, true)
  // MMTH 000 034

  const isCreditPaymentMethod = data.paymentMethod === EPaymentMethod.CREDIT

  if (!isCreditPaymentMethod) {
    /**
     * Upload payment image evidence
     */
    let _evidenceId: Types.ObjectId | undefined = undefined
    if (data.cashPaymentDetail) {
      const { imageEvidence, ...bankDetail } = data.cashPaymentDetail
      const _imageEvidence = new FileModel(imageEvidence)
      await _imageEvidence.save({ session })
      const _evidence = new PaymentEvidenceModel({ ...bankDetail, image: _imageEvidence._id })
      await _evidence.save({ session })
      _evidenceId = _evidence._id
    }

    /**
     * Payment
     */
    const paytype = isCreditPaymentMethod ? 'PAYCRE' : 'PAYCAS'
    const generateMonth = format(new Date(), 'yyMM')
    const _paymentNumber = await generateTrackingNumber(`${paytype}${generateMonth}`, 'payment', 3)
    const _payment = new PaymentModel({
      evidence: [_evidenceId],
      quotations: [_quotation._id],
      paymentMethod: EPaymentMethod.CASH,
      paymentNumber: _paymentNumber,
      status: EPaymentStatus.VERIFY,
      type: EPaymentType.PAY,
      subTotal: _quotation.price.subTotal,
      tax: _quotation.price.tax,
      total: _quotation.price.total,
    })
    await _payment.save({ session })

    /**
     * Billing
     */
    const _billing = new BillingModel({
      billingNumber: _trackingNumber,
      status: EBillingStatus.VERIFY,
      state: EBillingState.CURRENT,
      paymentMethod: EPaymentMethod.CASH,
      user: customerId,
      shipments: [_shipmentId],
      payments: [_payment._id],
      issueDate: today,
      billingStartDate: today,
      billingEndDate: today,
    })
    await _billing.save({ session })
  } else {
    /**
     * Update Customer Balance
     */
    await addCustomerCreditUsage(customerId, _quotationCalculation.price.total, session)
  }

  /**
   * Shipment
   */
  const _adminAcceptanceStatus = isCreditPaymentMethod ? EAdminAcceptanceStatus.REACH : EAdminAcceptanceStatus.PENDING
  const _driverAcceptanceStatus = isCreditPaymentMethod ? EDriverAcceptanceStatus.PENDING : EDriverAcceptanceStatus.IDLE

  const _shipment = new ShipmentModel({
    _id: _shipmentId,
    trackingNumber: _trackingNumber,
    status: EShipmentStatus.IDLE,
    adminAcceptanceStatus: _adminAcceptanceStatus,
    driverAcceptanceStatus: _driverAcceptanceStatus,
    customer: customerId,
    ...(data.favoriteDriverId ? { requestedDriver: data.favoriteDriverId } : {}),
    destinations: _destinations,
    displayDistance: data.displayDistance,
    displayTime: data.displayTime,
    returnDistance: data.returnDistance,
    distance: data.distance,
    isRoundedReturn: data.isRoundedReturn,
    vehicleId: data.vehicleId,
    additionalServices: _additionalServices,
    podDetail: data.podDetail,
    discountId: _discountId,
    isBookingWithDate: data.isBookingWithDate,
    bookingDateTime: data.bookingDateTime,
    additionalImages: _additionalImages,
    refId: data.refId,
    remark: data.remark,
    route: _route,
    paymentMethod: data.paymentMethod,
    formula: _formula,
    quotations: [_quotation],
  })
  await _shipment.save({ session })
  await initialStepDefinition(_shipment.id, undefined, session)

  /**
   * Notification
   */
  const notiTitle = !isCreditPaymentMethod ? 'การจองของท่านอยู่ระหว่างการยืนยัน' : 'การจองของท่านรอคนขับตอบรับ'
  const notiMsg = !isCreditPaymentMethod
    ? `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างดำเนินการยืนยันยอดชำระ`
    : `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างการตอบรับจากคนขับ`

  await NotificationModel.sendNotification({
    userId: customerId,
    varient: ENotificationVarient.INFO,
    title: notiTitle,
    message: [notiMsg],
    infoText: 'ติดตามการขนส่ง',
    infoLink: `/main/tracking?tracking_number=${_trackingNumber}`,
  })

  if (!isCreditPaymentMethod) {
    await NotificationModel.sendNotificationToAdmins({
      varient: ENotificationVarient.INFO,
      title: `กรุณาตรวจสอบการชำระหมายเลข ${_trackingNumber}`,
      message: [`ขณะนี้มีการจองงานขนส่งหมายเลข ${_trackingNumber} อยู่ระหว่างดำเนินการยืนยันยอดชำระตรวจสอบ`],
      infoText: 'รายละเอียดงานขนส่ง',
      infoLink: `/general/shipments/${_trackingNumber}`,
      masterText: 'รายละเอียดการชำระ',
      masterLink: `/general/financial/cash/${_trackingNumber}`,
    })
  }

  /**
   * Email Sender
   * - Prepare content
   * - Sent
   */
  const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${_trackingNumber}`
  const movemate_link = `https://www.movematethailand.com`
  const email = customer.email
  const fullname = customer.fullname
  const originalText = head(_destinations)?.name || ''
  const destinationsText = reduce(
    tail(_destinations),
    (prev, curr) => {
      if (curr.name) {
        return prev ? `${prev}, ${curr.name}` : curr.name
      }
      return prev
    },
    '',
  )

  await addEmailQueue({
    from: process.env.MAILGUN_SMTP_EMAIL,
    to: email,
    subject: 'Movemate Thailand ได้รับการจองรถของคุณแล้ว',
    template: isCreditPaymentMethod ? 'booking_credit_success' : 'booking_cash_success',
    context: {
      fullname,
      tracking_number: _trackingNumber,
      original: originalText,
      destination: destinationsText,
      payment: isCreditPaymentMethod ? 'ออกใบแจ้งหนี้' : 'ชำระเงินสด (ผ่านการโอน)',
      tracking_link,
      movemate_link,
    },
  })

  return _shipment
}

/**
 * TODO: recheck to update credit
 * @param data
 * @param customerId
 * @param session
 */
export async function updateShipment(data: UpdateShipmentInput, adminId: string, session?: ClientSession) {
  const { isRounded, locations, vehicleTypeId, serviceIds, discountId, shipmentId, podDetail, remark, quotation } = data

  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  if (!_shipment) throw new GraphQLError('ไม่พบข้อมูลงานขนส่ง')

  const _customer = _shipment.customer as User | undefined
  if (!_customer) throw new GraphQLError('ไม่พบข้อมูลลูกค้าในงานขนส่ง')

  const _oldQuotation = last(sortBy(_shipment.quotations as Quotation[], 'createdAt').filter((_quotation) => includes([EQuotationStatus.ACTIVE], _quotation.status))) as Quotation
  
  if (!_oldQuotation) throw new GraphQLError('ไม่พบข้อมูลใบเสนอราคาเดิม')

  // --- 1. คำนวณราคาและเส้นทางใหม่ ---
  const _calculated = await calculateExistingQuotation(data, session)
  const _newQuotationData = _calculated.quotation

  // --- 2. สร้างใบเสนอราคา (Quotation) ใหม่เสมอ ---
  const today = new Date()
  const generateMonth = format(today, 'yyMM')
  const _quotationNumber = await generateTrackingNumber(`QU${generateMonth}`, 'quotation', 5)
  const _newQuotation = new QuotationModel({
    quotationNumber: _quotationNumber,
    quotationDate: today,
    price: _calculated.price,
    cost: _calculated.cost,
    detail: {
      shippingPrices: [
        pick(_newQuotationData.shipping, ['label', 'price', 'cost']),
        ...(_newQuotationData.rounded ? [pick(_newQuotationData.rounded, ['label', 'price', 'cost'])] : []),
      ],
      additionalServices: map(_newQuotationData.services, (_services) => pick(_services, ['label', 'price', 'cost'])),
      discounts: _newQuotationData.discount ? [pick(_newQuotationData.discount, ['label', 'price', 'cost'])] : [],
      taxs: _newQuotationData.taxs ? [pick(_newQuotationData.taxs, ['label', 'price', 'cost'])] : [],
      subTotal: _newQuotationData.subTotal,
      tax: _newQuotationData.tax,
      total: _newQuotationData.total,
    },
    subTotal: _newQuotationData.subTotal,
    tax: _newQuotationData.tax,
    total: _newQuotationData.total,
    remark: remark,
    updatedBy: adminId,
  })
  await _newQuotation.save({ session })

  // ====================================================================
  // --- 3. จัดการ Logic การเงินตามประเภทการชำระเงิน (สำคัญที่สุด) ---
  // ====================================================================
  const _price = _calculated.price
  const _priceDifference = _price.acturePrice
  const _tax = _price.tax > 0 ? _priceDifference * (1 / (100 - 1)) : 0
  const _newSubTotal = _priceDifference + _tax

  // const priceDifference = _newQuotationData.price.tax
  // const priceDifference = _newQuotationData.price.acturePrice

  if (_shipment.paymentMethod === EPaymentMethod.CREDIT) {
    // ** LOGIC สำหรับงานเครดิต: ปรับปรุง Credit Usage **
    // ไม่ว่างานจะกำลังทำหรือจบแล้ว (แต่ยังไม่ถึงรอบบิล) ให้ปรับที่ยอด Credit Usage โดยตรง
    if (_priceDifference !== 0) {
      await addCustomerCreditUsage(_customer._id.toString(), _priceDifference, session)
    }
  } else {
    // ** LOGIC สำหรับงานเงินสด **
    const _cashBilling = await BillingModel.findOne({ billingNumber: _shipment.trackingNumber }).session(session)
    const _lastPayment = last(sortBy(_cashBilling.payments as Payment[], 'createdAt').filter(_payment => !includes([EPaymentStatus.CANCELLED], _payment.status)))

    if (_lastPayment && _lastPayment.status === EPaymentStatus.COMPLETE) {
      // ** กรณีจ่ายเงินแล้ว: สร้าง Payment ใหม่ "เฉพาะส่วนต่าง" **
      if (_priceDifference !== 0) {
        const isRefund = _priceDifference < 0
        const paymentType = isRefund ? EPaymentType.REFUND : EPaymentType.PAY
        const trackingText = isRefund ? 'PAYRFU' : 'PAYCAS' // Refund vs Cash

        const _paymentNumber = await generateTrackingNumber(`${trackingText}${generateMonth}`, 'payment', 3)
        const _newPayment = new PaymentModel({
          quotations: [_newQuotation._id],
          paymentMethod: EPaymentMethod.CASH,
          paymentNumber: _paymentNumber,
          status: _priceDifference === 0 ? EPaymentStatus.COMPLETE : EPaymentStatus.PENDING,
          type: paymentType,
          total: Math.abs(_priceDifference), // ยอดเงินเป็นบวกเสมอ
          subTotal: Math.abs(_newSubTotal),
          tax: Math.abs(_tax),
          updatedBy: adminId,
        })
        await _newPayment.save({ session })

        const refundReason: BillingReason | undefined = isRefund
          ? {
              detail: `ยอดชำระเกิน ${fCurrency(Math.abs(_priceDifference))} บาท`,
              type: EBillingReason.REFUND_PAYMENT,
            }
          : undefined

        // เพิ่ม Payment ใหม่เข้าไปใน Billing เดิม
        await BillingModel.findByIdAndUpdate(
          _cashBilling._id,
          {
            status: isRefund ? EBillingStatus.VERIFY : EBillingStatus.PENDING,
            updatedBy: adminId,
            $push: { payments: _newPayment._id, ...(refundReason ? { reasons: refundReason } : {}) },
          },
          { session },
        )

        /**
         * ========================================
         * ============ TRANSACTIONS ==============
         * === Calculate WHT 1% for driver here ===
         * ========================================
         */
        // if (
        //   includes([EDriverAcceptanceStatus.ACCEPTED, EDriverAcceptanceStatus.ASSIGN], _shipment.driverAcceptanceStatus)
        // ) {
        //   const costDifference = _newQuotationData.cost.acturePrice
        //   if (costDifference > 0) {
        //     const cost = _newQuotation?.cost
        //     const isAgentDriver = !isEmpty(_shipment?.agentDriver)
        //     const agentDriverId = get(_shipment, 'agentDriver._id', '')
        //     const driverId = get(_shipment, 'driver._id', '')
        //     const ownerDriverId = isAgentDriver ? agentDriverId : driverId

        //     const driverOwner = await UserModel.findById(ownerDriverId).session(session)
        //     if (isAgentDriver && driverId) {
        //       /**
        //        * Update employee transaction
        //        */
        //       const employeeTransaction = new TransactionModel({
        //         amountTax: 0, // WHT
        //         amountBeforeTax: 0,
        //         amount: 0,
        //         ownerId: driverId,
        //         ownerType: ETransactionOwner.BUSINESS_DRIVER,
        //         description: `${_shipment?.trackingNumber} งานจาก ${driverOwner.fullname}`,
        //         refId: _shipment?._id,
        //         refType: ERefType.SHIPMENT,
        //         transactionType: ETransactionType.INCOME,
        //         status: ETransactionStatus.COMPLETE,
        //       })
        //       await employeeTransaction.save({ session })
        //     }
        //     /**
        //      * Add transaction for shipment driver owner
        //      */
        //     const driverTransaction = new TransactionModel({
        //       amountTax: 0, // WHT
        //       amountBeforeTax: Math.abs(_newQuotationData.cost?.acturePrice || 0),
        //       amount: Math.abs(_newQuotationData.cost?.acturePrice || 0),
        //       ownerId: ownerDriverId,
        //       ownerType: ETransactionOwner.DRIVER,
        //       description: `ค่าใช้จ่ายเพิ่มเติมจาก #${_shipment.trackingNumber}`,
        //       refId: _shipment?._id,
        //       refType: ERefType.SHIPMENT,
        //       transactionType: ETransactionType.INCOME,
        //       status: ETransactionStatus.PENDING,
        //     })
        //     await driverTransaction.save({ session })

        //     // Update balance
        //     if (driverOwner) {
        //       const driverOwnerId = get(driverOwner, 'driverDetail._id', '')
        //       const driverDetail = await DriverDetailModel.findById(driverOwnerId)
        //       await driverDetail.updateBalance(session)
        //     }
        //   }
        // }
      }
    } else {
      // ** กรณีที่ยังไม่ได้จ่าย หรือจ่ายแล้วแต่ไม่สำเร็จ: ยกเลิกของเก่า สร้างใหม่เต็มจำนวน **
      if (_lastPayment) {
        await PaymentModel.findByIdAndUpdate(
          _lastPayment._id,
          { status: EPaymentStatus.CANCELLED, updatedBy: adminId },
          { session },
        )
        const _qoutationIds = ((_lastPayment?.quotations || []) as Quotation[]).map(_quotation => _quotation._id)
        await QuotationModel.updateMany({ _id: { $in: _qoutationIds }}, { status: EQuotationStatus.VOID })
      }

      const _paymentNumber = await generateTrackingNumber(`PAYCAS${generateMonth}`, 'payment', 3)
      const _newFullPayment = new PaymentModel({
        quotations: [_newQuotation._id],
        paymentMethod: EPaymentMethod.CASH,
        paymentNumber: _paymentNumber,
        status: EPaymentStatus.PENDING,
        type: EPaymentType.PAY,
        total: _newQuotation.total, // ใช้ยอดใหม่เต็มจำนวน
        subTotal: _newQuotation.subTotal,
        updatedBy: adminId,
      })
      await _newFullPayment.save({ session })

      // อัปเดต Billing เดิมให้ใช้ Payment ใหม่นี้ (แทนที่ของเก่าที่ถูกยกเลิก)
      await BillingModel.findByIdAndUpdate(_cashBilling._id, { $push: { payments: _newFullPayment._id } }, { session })
    }
  }

  // --- 4. อัปเดตข้อมูลอื่นๆ ของ Shipment (Logic เดิม) ---
  const _isRoundedChanged = _shipment.isRoundedReturn !== isRounded
  const _oldDropoffLocationsPlaceID = map(tail(_shipment.destinations), 'placeId')
  const _newDropoffLocationsPlaceID = map(tail(locations), 'placeId')
  const _locationDropoffChanged = !isEqual(_oldDropoffLocationsPlaceID, _newDropoffLocationsPlaceID)

  /**
   * Destination
   */
  const _destinations = await Aigle.map<DestinationInput, Destination>(locations, async (location) => {
    const { place } = await getPlaceDetail(location.placeId)
    const { province, district, subDistrict } = extractThaiAddress(place.addressComponents || [])
    return {
      ...location,
      placeDetail: place,
      placeProvince: province,
      placeDistrict: district,
      placeSubDistrict: subDistrict,
    }
  })

  /**
   * Additional Service Cost Pricng
   */
  const _isExistingPODService = find(_shipment.additionalServices, ['reference.additionalService.name', VALUES.POD])
  let _isPODServiceIncluded = false

  const _shipmentAdditionalServicesPricing = await Aigle.map(serviceIds, async (serviceId) => {
    const service = find(_shipment.additionalServices || [], ['reference._id', serviceId]) as
      | ShipmentAdditionalServicePrice
      | undefined
    if (service) {
      const serviceName = get(service, 'reference.additionalService.name', '')
      if (serviceName === VALUES.POD) {
        _isPODServiceIncluded = true
      }
      return service._id
    } else {
      const _newService = await AdditionalServiceCostPricingModel.findById(serviceId).session(session)
      if (_newService) {
        const additionalService = _newService.additionalService as AdditionalService
        if (additionalService.name === VALUES.POD) {
          _isPODServiceIncluded = true
        }
        const _shipmentAddtionalService = new ShipmentAdditionalServicePriceModel({
          cost: _newService.cost,
          price: _newService.price,
          reference: _newService._id,
        })
        await _shipmentAddtionalService.save({ session })
        return _shipmentAddtionalService._id
      }
      return ''
    }
  })

  await DirectionsResultModel.findByIdAndUpdate(
    get(_shipment, 'route._id', ''),
    {
      rawData: JSON.stringify(_calculated.routes),
    },
    { session },
  )

  const _updatedShipment = await ShipmentModel.findByIdAndUpdate(
    _shipment._id,
    {
      distance: _calculated.distance,
      returnDistance: _calculated.returnDistance,
      displayDistance: _calculated.displayDistance,
      displayTime: _calculated.displayTime,
      discountId: discountId,
      destinations: _destinations,
      isRoundedReturn: isRounded,
      vehicleId: vehicleTypeId,
      additionalServices: _shipmentAdditionalServicesPricing,
      ...(podDetail ? { podDetail } : {}),
      $push: { quotations: [_newQuotation] },
    },
    { session, new: true },
  )

  if (includes([EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING], _updatedShipment.status)) {
    /**
     * Updating Step Definition
     */
    const _steps = sortBy(_updatedShipment.steps, 'seq')
    if (_isExistingPODService && !_isPODServiceIncluded) {
      const existingPOD = find(_steps, ['step', EStepDefinition.POD]) as StepDefinition | undefined
      if (existingPOD) {
        // Removal POD step
        await removeStep(_updatedShipment._id, existingPOD._id, session)
      }
    } else if (!_isExistingPODService && _isPODServiceIncluded) {
      // Add POD step
      const existingPOD = find(_steps, ['step', EStepDefinition.POD])
      if (!existingPOD) {
        const dropoffLocationSteps = filter(_steps, (step: StepDefinition) => step.step === EStepDefinition.DROPOFF)
        const lastDropoff = last(sortBy(dropoffLocationSteps, 'seq')) as StepDefinition | undefined
        const _seq = (lastDropoff.seq || 0) + 1
        const podStep = new StepDefinitionModel({
          seq: _seq,
          step: EStepDefinition.POD,
          stepName: EStepDefinitionName.POD,
          customerMessage: 'แนบเอกสารและส่งเอกสาร POD',
          driverMessage: 'แนบเอกสารและส่งเอกสาร POD',
          stepStatus: EStepStatus.IDLE,
        })
        await addStep(_updatedShipment._id, podStep, _seq, session)
      }
    }

    /**
     * Update ไป - กลับ
     * - Check ถ้าดำเนินการส่งของกลับแล้ว(ARRIVAL_DROPOFF และ DROPOFF) จะแก้ไขไปกลับไม่ได้ ทั้ง
     * - เพิ่มลด step
     */
    if (_isRoundedChanged) {
      const _roundedSteps = await ShipmentModel.findById(_shipment._id).distinct('steps').session(session)
      if (isRounded) {
        /**
         * New returned steps
         */
        const dropoffLocationSteps = filter(
          _roundedSteps,
          (step: StepDefinition) => step.step === EStepDefinition.DROPOFF,
        )
        const lastDropoff = last(sortBy(dropoffLocationSteps, 'seq')) as StepDefinition | undefined
        if (lastDropoff) {
          const _arrivalDropoffStepSeq = lastDropoff.seq + 1
          const _arrivalDropoffStep = new StepDefinitionModel({
            seq: _arrivalDropoffStepSeq,
            step: EStepDefinition.ARRIVAL_DROPOFF,
            stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
            customerMessage: 'ถึงจุดส่งสินค้ากลับ',
            driverMessage: 'จุดส่งสินค้า(กลับไปยังต้นทาง)',
            stepStatus: EStepStatus.IDLE,
            meta: -1,
          })
          await addStep(_updatedShipment._id, _arrivalDropoffStep, _arrivalDropoffStepSeq, session)
          const __dropoffStepSeq = lastDropoff.seq + 2
          const _dropoffStep = new StepDefinitionModel({
            seq: __dropoffStepSeq,
            step: EStepDefinition.DROPOFF,
            stepName: EStepDefinitionName.DROPOFF,
            customerMessage: 'จัดส่งสินค้ากลับ',
            driverMessage: 'จุดส่งสินค้า (กลับไปยังต้นทาง)',
            stepStatus: EStepStatus.IDLE,
            meta: -1,
          })
          await addStep(_updatedShipment._id, _dropoffStep, __dropoffStepSeq, session)
        }
      } else {
        /**
         * Remove returned steps
         */
        const existingArrivalDropoff = find(_roundedSteps, { step: EStepDefinition.ARRIVAL_DROPOFF, meta: -1 })
        const existingDropoff = find(_roundedSteps, { step: EStepDefinition.DROPOFF, meta: -1 })
        if (existingArrivalDropoff && existingDropoff) {
          const _arrivalDropoff = existingArrivalDropoff as StepDefinition
          const _dropoff = existingDropoff as StepDefinition
          await removeStep(_updatedShipment._id, _arrivalDropoff._id, session) // Remove ARRIVAL_DROPOFF
          await removeStep(_updatedShipment._id, _dropoff._id, session) // Remove DROPOFF
        }
      }
    }

    /**
     * - Update direction Dropoff Locations
     * - Check ถ้าดำเนินการแล้วจะแก้เส้นทางไม่ได้
     * - เพิ่มลด step
     */
    if (_locationDropoffChanged) {
      const isMultiple = locations.length > 2
      const _locationSteps = await ShipmentModel.findById(_shipment._id).distinct('steps').session(session)
      const _dropoffStepsFilter = filter(_locationSteps, (step: StepDefinition) => {
        return step.step === EStepDefinition.ARRIVAL_DROPOFF || step.step === EStepDefinition.DROPOFF
      })

      const oldLength = _shipment.destinations.length
      const newLength = locations.length
      const differenceLength = oldLength - newLength

      const _dropoffStepsSort = sortBy(_dropoffStepsFilter, ['seq', 'meta']) as StepDefinition[]
      const _lastDropoffSteps = last(_dropoffStepsSort) as StepDefinition
      const lastSeq = _lastDropoffSteps.seq
      const lastMeta = _lastDropoffSteps.meta

      if (differenceLength > 0) {
        // Add new by len
        const ranges = range(1, differenceLength)
        const range_length = ranges.length
        await Aigle.map(ranges, async (seq, index) => {
          const isLast = range_length - 1 >= index
          const newSeq = lastSeq + seq
          const newMeta = lastMeta + seq
          const _newArrivalDropoffStep = new StepDefinitionModel({
            step: EStepDefinition.ARRIVAL_DROPOFF,
            seq: newSeq,
            stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
            customerMessage: isMultiple ? `ถึงจุดส่งสินค้าที่ ${newMeta}` : 'ถึงจุดส่งสินค้า',
            driverMessage: isMultiple
              ? `ถึงจุดส่งสินค้าที่ ${newMeta}${isLast ? ' (จุดสุดท้าย)' : ''}`
              : 'ถึงจุดส่งสินค้า',
            stepStatus: EStepStatus.IDLE,
            meta: newMeta,
          })
          await addStep(_updatedShipment._id, _newArrivalDropoffStep, newSeq, session)
          const _newDropoffStepSeq = newSeq + 1
          const _newDropoffStep = new StepDefinitionModel({
            step: EStepDefinition.DROPOFF,
            seq: newSeq + 1,
            stepName: EStepDefinitionName.DROPOFF,
            customerMessage: isMultiple ? `จัดส่งสินค้าจุดที่ ${newMeta}` : 'จัดส่งสินค้า',
            driverMessage: isMultiple
              ? `ลงสินค้าจุดที่ ${newMeta}${isLast ? ' (จุดสุดท้าย)' : ''}`
              : 'ลงสินค้าที่จุดส่งสินค้า',
            stepStatus: EStepStatus.IDLE,
            meta: newMeta,
          })
          await addStep(_updatedShipment._id, _newDropoffStep, _newDropoffStepSeq, session)
        })
      } else if (differenceLength < 0) {
        /**
         * Removal Step
         */
        const startRemovalMeta = lastMeta - Math.abs(differenceLength) + 1
        const removalSteps = filter(_dropoffStepsSort, (step: StepDefinition) => step.meta >= startRemovalMeta)
        await Aigle.map(removalSteps, async (_removalStep) => {
          await removeStep(_updatedShipment._id, _removalStep._id, session)
        })
      }
    }
  }

  // Notification
  await NotificationModel.sendNotification(
    {
      userId: _customer?._id,
      varient: ENotificationVarient.INFO,
      title: 'การจองของท่านมีการเปลี่ยนแปลง',
      message: [
        `เราขอแจ้งให้ท่านทราบว่าการจองหมายเลข ${_shipment.trackingNumber} มีการเปลี่ยนแปลงโปรดตรวจสอบ หากผิดข้อผิดพลาดกรุณาแจ้งผู้ดูแล`,
      ],
      infoText: 'ดูงานขนส่ง',
      infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
    },
    session,
  )

  if (_shipment.status === EShipmentStatus.PROGRESSING && (_shipment.driver || _shipment.agentDriver)) {
    const agentDriverId = get(_shipment, 'agentDriver._id', '')
    if (agentDriverId) {
      await NotificationModel.sendNotification(
        {
          userId: agentDriverId,
          varient: ENotificationVarient.INFO,
          title: 'งานขนส่งมีการเปลี่ยนแปลง',
          message: [
            `เราขอแจ้งให้ท่านทราบว่างานขนส่งหมายเลข ${_shipment.trackingNumber} มีการเปลี่ยนแปลงโปรดตรวจสอบ หากผิดข้อผิดพลาดกรุณาแจ้งผู้ดูแล`,
          ],
        },
        session,
        true,
        { navigation: ENavigationType.SHIPMENT, trackingNumber: _shipment.trackingNumber },
      )
    }
    const driverId = get(_shipment, 'driver._id', '')
    if (driverId) {
      await NotificationModel.sendNotification(
        {
          userId: driverId,
          varient: ENotificationVarient.INFO,
          title: 'งานขนส่งมีการเปลี่ยนแปลง',
          message: [
            `เราขอแจ้งให้ท่านทราบว่างานขนส่งหมายเลข ${_shipment.trackingNumber} มีการเปลี่ยนแปลงโปรดตรวจสอบ หากผิดข้อผิดพลาดกรุณาแจ้งผู้ดูแล`,
          ],
        },
        session,
        true,
        { navigation: ENavigationType.SHIPMENT, trackingNumber: _shipment.trackingNumber },
      )
    }
  }
}
