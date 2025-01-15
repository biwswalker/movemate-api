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
  groupBy,
  head,
  includes,
  isEqual,
  last,
  map,
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
import { BillingReason, Price } from '@models/finance/objects'
import QuotationModel from '@models/finance/quotation.model'
import { EAdminAcceptanceStatus, EDriverAcceptanceStatus, EShipmentStatus } from '@enums/shipments'
import BillingModel from '@models/finance/billing.model'
import { EBillingReason, EBillingState, EBillingStatus } from '@enums/billing'
import ShipmentModel from '@models/shipment.model'
import { initialStepDefinition } from './steps'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
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
export async function updateShipment(data: UpdateShipmentInput, adminId: string, session?: ClientSession) {
  const { isRounded, locations, vehicleTypeId, serviceIds, discountId, shipmentId, podDetail, quotation } = data

  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  const _customer = _shipment.customer as User | undefined

  const _isRoundedChanged = _shipment.isRoundedReturn === isRounded

  const _oldDropoffLocationsPlaceID = map(tail(_shipment.destinations), (location) => location.placeId)
  const _newDropoffLocationsPlaceID = map(tail(locations), (location) => location.placeId)
  const _locationDropoffChanged = !isEqual(_oldDropoffLocationsPlaceID, _newDropoffLocationsPlaceID)

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

  const _calculated = await calculateExistingQuotation(data, session)

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
      const _newService = await AdditionalServiceCostPricingModel.findById(serviceId) //.session(session)
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
        await _shipmentAddtionalService.save()
        return _shipmentAddtionalService._id
      }
      return ''
    }
  })

  const _calculateQuotation = _calculated.quotation
  const today = new Date()
  const generateMonth = format(today, 'yyMM')
  const _quotationNumber = await generateTrackingNumber(`QU${generateMonth}`, 'quotation', 5)
  const _quotation = new QuotationModel({
    quotationNumber: _quotationNumber,
    quotationDate: today,
    price: _calculateQuotation.price,
    cost: _calculateQuotation.cost,
    detail: _calculateQuotation.detail,
    subTotal: _calculateQuotation.subTotal,
    tax: _calculateQuotation.tax,
    total: _calculateQuotation.total,
    updatedBy: adminId,
  })
  await _quotation.save({ session })

  if (_shipment.paymentMethod === EPaymentMethod.CASH) {
    /**
     * Payment
     */
    const acturePrice = _calculateQuotation.price.acturePrice
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
    const _cashBilling = await BillingModel.findOne({ billingNumber: _shipment.trackingNumber })
    const _lastPayment = last(sortBy(_cashBilling.payments, 'createdAt')) as Payment | undefined
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

    /**
     * Update if old exisiting is not complete
     */
    if (_lastPayment) {
      if (includes([EPaymentStatus.PENDING, EPaymentStatus.VERIFY], _lastPayment.status)) {
        await PaymentModel.findByIdAndUpdate(
          _lastPayment._id,
          { status: EPaymentStatus.CANCELLED, updatedBy: adminId },
          { session },
        )
      }
    }
  } else {
    /**
     * Update customer usage credit
     */
    await addCustomerCreditUsage(_customer?._id, _quotation.price.acturePrice)
  }

  await DirectionsResultModel.findByIdAndUpdate(get(_shipment, 'route._id', ''), {
    rawData: JSON.stringify(_calculated.routes),
  })

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
      $push: {
        quotations: [_quotation],
      },
    },
    { session, new: true },
  )

  if (includes([EShipmentStatus.IDLE, EShipmentStatus.PROGRESSING], _updatedShipment.status)) {
    /**
     * Updating Step Definition
     */
    const _steps = _updatedShipment.steps
    if (_isExistingPODService && !_isPODServiceIncluded) {
      const existingPOD = find(_steps, ['step', EStepDefinition.POD]) as StepDefinition | undefined
      if (existingPOD) {
        // Removal POD step
        await removeStep(_updatedShipment._id, existingPOD.seq, session)
      }
    } else if (!_isExistingPODService && _isPODServiceIncluded) {
      // Add POD step
      const existingPOD = find(_steps, ['step', EStepDefinition.POD])
      if (!existingPOD) {
        const dropoffLocationSteps = filter(_steps, (step: StepDefinition) => step.step === EStepDefinition.DROPOFF)
        const lastDropoff = last(sortBy(dropoffLocationSteps, 'seq')) as StepDefinition | undefined
        const _index = lastDropoff.seq || 0
        const podStep = new StepDefinitionModel({
          seq: _index + 1,
          step: EStepDefinition.POD,
          stepName: EStepDefinitionName.POD,
          customerMessage: 'แนบเอกสารและส่งเอกสาร POD',
          driverMessage: 'แนบเอกสารและส่งเอกสาร POD',
          stepStatus: EStepStatus.IDLE,
        })
        await addStep(_updatedShipment._id, podStep, session)
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
          const _arrivalDropoffStep = new StepDefinitionModel({
            seq: lastDropoff.seq + 1,
            step: EStepDefinition.ARRIVAL_DROPOFF,
            stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
            customerMessage: 'ถึงจุดส่งสินค้ากลับ',
            driverMessage: 'จุดส่งสินค้า(กลับไปยังต้นทาง)',
            stepStatus: EStepStatus.IDLE,
            meta: -1,
          })
          await addStep(_updatedShipment._id, _arrivalDropoffStep, session)
          const _dropoffStep = new StepDefinitionModel({
            seq: lastDropoff.seq + 2,
            step: EStepDefinition.DROPOFF,
            stepName: EStepDefinitionName.DROPOFF,
            customerMessage: 'จัดส่งสินค้ากลับ',
            driverMessage: 'จุดส่งสินค้า (กลับไปยังต้นทาง)',
            stepStatus: EStepStatus.IDLE,
            meta: -1,
          })
          await addStep(_updatedShipment._id, _dropoffStep, session)
        }
      } else {
        /**
         * Remove returned steps
         */
        const existingArrivalDropoff = find(_roundedSteps, { step: EStepDefinition.ARRIVAL_DROPOFF, meta: -1 })
        const existingDropoff = find(_roundedSteps, { step: EStepDefinition.DROPOFF, meta: -1 })
        if (existingArrivalDropoff && existingDropoff) {
          const arrivalDropoff = existingArrivalDropoff as StepDefinition
          const _removeStepIndex = arrivalDropoff.seq
          // Remove ARRIVAL_DROPOFF
          await removeStep(_updatedShipment._id, _removeStepIndex, session)
          // Remove DROPOFF
          await removeStep(_updatedShipment._id, _removeStepIndex, session)
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

      const _dropoffStepsSort = sortBy(_dropoffStepsFilter, ['seq', 'meta'])
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
            driverMessage: isMultiple ? `จุดส่งสินค้าที่ ${newMeta}${isLast ? ' (จุดสุดท้าย)' : ''}` : 'จุดส่งสินค้า',
            stepStatus: EStepStatus.IDLE,
            meta: newMeta,
          })
          await addStep(_updatedShipment._id, _newArrivalDropoffStep, session)
          const _newDropoffStep = new StepDefinitionModel({
            step: EStepDefinition.DROPOFF,
            seq: newSeq + 1,
            stepName: EStepDefinitionName.DROPOFF,
            customerMessage: isMultiple ? `จัดส่งสินค้าจุดที่ ${newMeta}` : 'จัดส่งสินค้า',
            driverMessage: isMultiple ? `จุดส่งสินค้าที่ ${newMeta}${isLast ? ' (จุดสุดท้าย)' : ''}` : 'จุดส่งสินค้า',
            stepStatus: EStepStatus.IDLE,
            meta: newMeta,
          })
          await addStep(_updatedShipment._id, _newDropoffStep, session)
        })
      } else if (differenceLength < 0) {
        /**
         * Removal Step
         */
        const startRemovalMeta = lastMeta - Math.abs(differenceLength) + 1
        const removalSteps = filter(_dropoffStepsSort, (step: StepDefinition) => step.meta >= startRemovalMeta)
        const _removalStepGroup = groupBy(removalSteps, 'meta')
        const _removalValues = values(_removalStepGroup)
        await Aigle.map(_removalValues, async (_) => {
          // Remove ARRIVAL_DROPOFF
          await removeStep(_updatedShipment._id, startRemovalMeta, session)
          // Remove DROPOFF
          await removeStep(_updatedShipment._id, startRemovalMeta, session)
        })
      }
    }
  }

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
