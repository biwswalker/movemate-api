import { DestinationInput, ShipmentInput } from '@inputs/shipment.input'
import UserModel, { User } from '@models/user.model'
import VehicleTypeModel from '@models/vehicleType.model'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation, ClientSession, Types } from 'mongoose'
import lodash, { filter, find, get, head, includes, isEmpty, map, reduce, tail, values } from 'lodash'
import { Destination } from '@models/shipment/objects'
import { extractThaiAddress, getPlaceDetail } from '@services/maps/location'
import { calculateQuotation } from './quotation'
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
import PaymentModel from '@models/finance/payment.model'
import { BillingReason } from '@models/finance/objects'
import QuotationModel from '@models/finance/quotation.model'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import BillingModel from '@models/finance/billing.model'
import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import ShipmentModel from '@models/shipment.model'
import { initialStepDefinition } from './steps'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import addEmailQueue from '@utils/email.utils'
import { CalculationInput } from '@inputs/booking.input'
import { fCurrency } from '@utils/formatNumber'
import { addCustomerCreditUsage } from './customer'
import PaymentEvidenceModel from '@models/finance/evidence.model'

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
    const privilege = await PrivilegeModel.findOne({ _id: data.discountId, usedUser: { $nin: customerId } })
      .session(session)
      .lean()
    if (!privilege) {
      const message = 'ไม่สามารถหาข้อมูลส่วนลดได้ เนื่องจากไม่พบส่วนลดดังกล่าว'
      throw new GraphQLError(message, {
        extensions: { code: 'NOT_FOUND', errors: [{ message }] },
      })
    }
    await PrivilegeModel.findByIdAndUpdate(privilege._id, { $push: { usedUser: customerId } }, { session })
    _discountId = privilege._id
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
  const _trackingNumber = await generateTrackingNumber('MMTH', 'tracking')

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
    userId: customer._id,
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
    from: process.env.NOREPLY_EMAIL,
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
export async function updateShipment(data: CalculationInput, adminId: string, session?: ClientSession) {
  const { isRounded, locations, vehicleTypeId, serviceIds, discountId, shipmentId } = data

  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  const _customer = _shipment.customer as User | undefined

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

  const _quotationCalculation = await calculateQuotation(
    {
      isRounded: isRounded,
      locations: locations,
      vehicleTypeId: vehicleTypeId,
      discountId: discountId,
      serviceIds: serviceIds,
      shipmentId: shipmentId,
    },
    _customer?._id,
    session,
  )

  // Duplicate additional service cost for invoice data
  const oldServices = filter(_shipment.additionalServices as ShipmentAdditionalServicePrice[], (service) => {
    const _id = get(service, 'reference._id', '')
    return includes(serviceIds, _id.toString())
  }).map((service) => service._id.toString())

  const excludeServices = filter(serviceIds, (serviceId) => {
    const service = find(_shipment.additionalServices, ['reference._id', serviceId])
    return isEmpty(service)
  })
  const serviceBulkOperations = await Aigle.map<string, AnyBulkWriteOperation>(
    excludeServices,
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

  const serviceBulkResult = await ShipmentAdditionalServicePriceModel.bulkWrite(serviceBulkOperations)
  const _additionalServices = values(serviceBulkResult.insertedIds)

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
    updatedBy: adminId,
  })
  await _quotation.save({ session })

  if (_shipment.paymentMethod === EPaymentMethod.CASH) {
    /**
     * Payment
     */
    const acturePrice = _quotationCalculation.price.acturePrice
    const isRefundProcesss = acturePrice < 0
    const trackingText = isRefundProcesss ? 'PAYRFU' : 'PAYCAS'
    const generateMonth = format(new Date(), 'yyMM')
    const _paymentNumber = await generateTrackingNumber(`${trackingText}${generateMonth}`, 'payment', 3)

    const _newPayment = new PaymentModel({
      quotations: [_quotation._id],
      paymentMethod: EPaymentMethod.CASH,
      paymentNumber: _paymentNumber,
      status: acturePrice === 0 ? EPaymentStatus.COMPLETE : EPaymentStatus.PENDING,
      type: isRefundProcesss ? EPaymentType.CHANGE : EPaymentType.PAY,
      tax: 0,
      total: acturePrice,
      subTotal: acturePrice,
      updatedBy: adminId,
    })
    await _newPayment.save({ session })

    const refundReason: BillingReason | undefined = isRefundProcesss
      ? {
          detail: `ยอดชำระเกิน ${fCurrency(Math.abs(acturePrice))} บาท`,
          type: EBillingReason.REFUND_PAYMENT,
        }
      : undefined
    await BillingModel.findOneAndUpdate(
      { billingNumber: _shipment.trackingNumber },
      {
        status: acturePrice === 0 ? EBillingStatus.COMPLETE : EBillingStatus.VERIFY,
        state: EBillingState.CURRENT,
        updatedBy: adminId,
        $push: {
          payments: _newPayment._id,
          ...(refundReason ? { reasons: refundReason } : {}),
        },
      },
      { session },
    )
  } else {
    /**
     * Update customer usage credit
     */
    await addCustomerCreditUsage(_customer?._id, _quotation.price.acturePrice)
  }

  await DirectionsResultModel.findByIdAndUpdate(get(_shipment, 'route._id', ''), {
    rawData: JSON.stringify(_quotationCalculation.routes),
  })
  await ShipmentModel.findByIdAndUpdate(
    _shipment._id,
    {
      distance: _quotationCalculation.distance,
      returnDistance: _quotationCalculation.returnDistance,
      displayDistance: _quotationCalculation.displayDistance,
      displayTime: _quotationCalculation.displayTime,
      discountId: discountId,
      destinations: _destinations,
      isRoundedReturn: isRounded,
      vehicleId: vehicleTypeId,
      additionalServices: [...oldServices, ..._additionalServices],
      $push: {
        quotations: [_quotation],
      },
    },
    { session },
  )

  // Noti
  await NotificationModel.sendNotification({
    userId: _customer?._id,
    varient: ENotificationVarient.INFO,
    title: 'การจองของท่านมีการเปลี่ยนแปลง',
    message: [
      `เราขอแจ้งให้ท่าทราบว่าการจองหมายเลข ${_shipment.trackingNumber} มีการเปลี่ยนแปลงโปรดตรวจสอบ หากผิดข้อผิดพลาดกรุณาแจ้งผู้ดูแล`,
    ],
    infoText: 'ดูงานขนส่ง',
    infoLink: `/main/tracking?tracking_number=${_shipment.trackingNumber}`,
  })
}
