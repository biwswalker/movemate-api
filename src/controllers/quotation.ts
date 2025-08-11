import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import { CalculationInput, PriceEditorItemInput, UpdateShipmentInput } from '@inputs/booking.input'
import AdditionalServiceCostPricingModel, {
  AdditionalServiceCostPricing,
} from '@models/additionalServiceCostPricing.model'
import { DistanceCostPricing, EDistanceCostPricingUnit } from '@models/distanceCostPricing.model'
import PaymentModel from '@models/finance/payment.model'
import { Quotation } from '@models/finance/quotation.model'
import ShipmentModel from '@models/shipment.model'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import VehicleCostModel from '@models/vehicleCost.model'
import { VehicleType } from '@models/vehicleType.model'
import { CalculationResultPayload } from '@payloads/pricing.payloads'
import { getRoute } from '@services/maps/location'
import { GraphQLError } from 'graphql'
import { find, forEach, get, head, includes, last, map, random, reduce, sortBy, sum, sumBy, tail } from 'lodash'
import ceil from 'lodash/ceil'
import { getAdditionalServicePrice } from './servicces'
import Aigle from 'aigle'
import PrivilegeModel from '@models/privilege.model'
import { EUserType } from '@enums/users'
import UserModel, { User } from '@models/user.model'
import { fNumber } from '@utils/formatNumber'
import { Price, PriceEditorItem, PriceItem, QuotationDetail, QuotationEditorDetail } from '@models/finance/objects'
import { ClientSession } from 'mongoose'
import { CalculateQuotationResultPayload, EditQuotationResultPayload } from '@payloads/quotation.payloads'
import { VALUES } from 'constants/values'
import { EPriceItemType } from '@enums/billing'

export async function calculateQuotation(
  data: CalculationInput,
  userId: string,
  session?: ClientSession,
): Promise<CalculateQuotationResultPayload> {
  const { vehicleTypeId, locations, isRounded, serviceIds, discountId, shipmentId } = data
  const shipment = shipmentId ? await ShipmentModel.findById(shipmentId).session(session) : undefined

  const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId, session)
  if (!vehicleCost) {
    const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
    throw new GraphQLError(message, {
      extensions: { code: 'NOT_FOUND', errors: [{ message }] },
    })
  }

  const original = head(locations)
  const destinationsRaw = tail(locations).map((destination) => destination.location)
  const destinations = isRounded ? [...destinationsRaw, original.location] : destinationsRaw

  /**
   * Get Routes detail from Google APIs
   */
  const computeRoutes = await getRoute(original.location, destinations).catch((error) => {
    console.log(JSON.stringify(error, undefined, 2))
    throw error
  })
  const directionRoutes = head(computeRoutes.routes)

  const {
    displayDistance,
    displayTime,
    distance: distanceMeter,
    returnDistance: returnDistanceMeter,
  } = handleGetDistanceDetail(directionRoutes, vehicleCost.vehicleType as VehicleType, isRounded)

  // Convert Meter to Kilomater
  const distanceKM = distanceMeter / 1000
  const distanceReturnKM = returnDistanceMeter / 1000

  /**
   * IF EXISTING SHIPMENT
   * Latest Payment
   */
  let formula = vehicleCost.distance as DistanceCostPricing[]
  let latestQuotation: Quotation | undefined = undefined
  let isPaymentComplete: boolean | undefined = undefined
  if (shipment) {
    const latestQuotations = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined
    if (shipment.paymentMethod === EPaymentMethod.CREDIT) {
      isPaymentComplete = true
    } else {
      const quotationsPayment = await PaymentModel.findOne({ quotations: { $in: [latestQuotations._id] } }).session(
        session,
      )
      isPaymentComplete = quotationsPayment?.status === EPaymentStatus.COMPLETE
    }
    latestQuotation = latestQuotations
    formula = sortBy(shipment.formula, ['form']) as DistanceCostPricing[]
  }

  /**
   * Original Distance Price/Cost
   */
  const distanceCalculation = calculateStep(distanceKM, formula)
  const distanceCost = distanceCalculation.cost
  const distancePrice = distanceCalculation.price

  /**
   * Droppoint Price/Cost
   */
  const dropPoint = locations.length - 1
  let droppointId = ''
  let droppointCost = 0
  let droppointPrice = 0
  if (dropPoint > 1) {
    const droppointCalculation = getAdditionalServicePrice(
      'หลายจุดส่ง',
      (shipment?.additionalServices as ShipmentAdditionalServicePrice[]) || [],
      (vehicleCost.additionalServices as AdditionalServiceCostPricing[]) || [],
    )
    droppointId = droppointCalculation.serviceId
    droppointCost = dropPoint * droppointCalculation.cost
    droppointPrice = dropPoint * droppointCalculation.price
  }

  /**
   *
   * Get Rounded percent
   */
  let roundedCost = 0
  let roundedPrice = 0
  let roundedCostPercent = 0
  let roundedPricePercent = 0
  if (isRounded) {
    const roundedCalculation = getAdditionalServicePrice(
      VALUES.ROUNDED_RETURN,
      (shipment?.additionalServices as ShipmentAdditionalServicePrice[]) || [],
      (vehicleCost.additionalServices as AdditionalServiceCostPricing[]) || [],
    )
    roundedCostPercent = roundedCalculation.cost || 0
    roundedPricePercent = roundedCalculation.price || 0
    const roundedCostPercentCal = roundedCostPercent / 100
    const roundedPricePercentCal = roundedPricePercent / 100

    // Round calculation
    const roundedCalculationStep = calculateStep(distanceReturnKM, formula)

    roundedCost = roundedCostPercentCal * roundedCalculationStep.cost
    roundedPrice = roundedPricePercentCal * roundedCalculationStep.price
  }

  /**
   *
   * Distance Price/Cost
   */
  const totalDistanceCost = sum([distanceCost, droppointCost, roundedCost])
  const totalDistancePrice = sum([distancePrice, droppointPrice, roundedPrice])

  /**
   * Additional Service Cost Pricng
   */
  const additionalServicesPricing = await Aigle.map<string, PriceItem>(serviceIds, async (serviceId) => {
    const service = find(shipment?.additionalServices || [], ['reference._id', serviceId]) as
      | ShipmentAdditionalServicePrice
      | undefined
    if (service) {
      const label = get(service, 'reference.additionalService.name', '')
      return {
        label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
        cost: service.cost,
        price: service.price,
        refId: serviceId,
      }
    } else {
      const newService = await AdditionalServiceCostPricingModel.findById(serviceId) //.session(session)
      if (newService) {
        const label = get(newService.additionalService, 'name', '')
        return {
          label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
          cost: newService.cost,
          price: newService.price,
          refId: newService._id,
        }
      } else {
        return {
          label: '',
          cost: 0,
          price: 0,
        }
      }
    }
  })

  const servicesTotalPrice = reduce(
    additionalServicesPricing,
    (prev, curr) => {
      const cost = sum([prev.cost, curr.cost])
      const price = sum([prev.price, curr.price])
      return { cost, price }
    },
    { cost: 0, price: 0 },
  )

  /**
   * Sub Total Price/Cost
   */
  const subTotalCost = sum([totalDistanceCost, servicesTotalPrice.cost])
  const subTotalPrice = sum([totalDistancePrice, servicesTotalPrice.price])

  /**
   *
   * Privilege
   */
  const { discountName, totalDiscount } = await PrivilegeModel.calculateDiscount(discountId, subTotalPrice)

  const subTotalAfterDiscountPrice = sum([subTotalPrice, -totalDiscount])

  /**
   * งานเงินสด
   * บริษัท
   * - แสดงและคำนวณ WHT ทุกครั้ง และแสดงทุกครั้ง
   * (ค่าขนส่งเกิน 1000 คิด WHT 1%)
   * (ค่าขนส่งน้อยกว่า 1000 คิดราคาเต็ม)
   */
  let whtName = ''
  let whtPrice = 0
  let isTaxCalculation = false
  const whtCost = subTotalCost * 0.01
  const customer = shipment ? shipment.customer : await UserModel.findById(userId)
  if (customer) {
    const customerTypes = get(customer, 'userType', '')
    isTaxCalculation = customerTypes === EUserType.BUSINESS
    if (isTaxCalculation) {
      whtName = 'ภาษีหัก ณ ที่จ่าย 1% (WHT)'
      whtPrice = subTotalAfterDiscountPrice * 0.01
    }
  }

  const vehicleName = get(vehicleCost, 'vehicleType.name', '')
  const distanceKMText = fNumber(distanceKM, '0,0.0')
  const distanceReturnKMText = fNumber(distanceReturnKM, '0,0.0')

  const totalCost = sum([subTotalCost, -whtCost])
  const totalPrice = sum([subTotalAfterDiscountPrice, -whtPrice])

  const latestTotalPrice = get(latestQuotation, 'price', undefined) as Price | undefined
  const latestTotalCost = get(latestQuotation, 'cost', undefined) as Price | undefined

  const actureCostToPay = sum([
    totalCost,
    -(latestTotalCost?.total || 0),
    isPaymentComplete ? 0 : latestTotalCost?.acturePrice || 0,
  ])
  const acturePriceToPay = sum([
    totalPrice,
    -(latestTotalPrice?.total || 0),
    isPaymentComplete ? 0 : latestTotalPrice?.acturePrice || 0,
  ])

  const _price: Price = {
    acturePrice: acturePriceToPay,
    droppoint: droppointPrice,
    rounded: roundedPrice,
    roundedPercent: roundedPricePercent,
    subTotal: subTotalPrice,
    tax: whtPrice,
    total: totalPrice,
  }
  const _cost: Price = {
    acturePrice: actureCostToPay,
    droppoint: droppointCost,
    rounded: roundedCost,
    roundedPercent: roundedCostPercent,
    subTotal: subTotalCost,
    tax: whtCost,
    total: totalCost,
  }
  const _detail: QuotationDetail = {
    shippingPrices: [
      {
        label: `${vehicleName} (${distanceKMText} กม.)`,
        price: distancePrice,
        cost: distanceCost,
      },
      ...(isRounded
        ? [
            {
              label: `${VALUES.ROUNDED_RETURN} ${roundedPricePercent}% (${distanceReturnKMText} กม.)`,
              price: roundedPrice,
              cost: roundedCost,
            },
          ]
        : []),
    ],
    additionalServices: [
      ...(dropPoint > 1
        ? [
            {
              label: 'หลายจุดส่ง',
              price: droppointPrice,
              cost: droppointCost,
            },
          ]
        : []),
      ...additionalServicesPricing,
    ],
    discounts: discountId ? [{ label: discountName, price: totalDiscount, cost: 0 }] : [],
    taxs: isTaxCalculation ? [{ label: whtName, price: whtPrice, cost: whtCost }] : [],
    subTotal: subTotalPrice,
    tax: whtPrice,
    total: totalPrice,
  }
  const _editDetail: QuotationEditorDetail = {
    shipping: {
      label: `${vehicleName} (${fNumber(distanceKMText)} กม.)`,
      cost: distanceCost,
      price: distancePrice,
      type: EPriceItemType.SHIPPING,
    },
    rounded: isRounded
      ? {
          label: `${VALUES.ROUNDED_RETURN} ${roundedPricePercent}% (${distanceReturnKMText} กม.)`,
          cost: roundedCost,
          price: roundedPrice,
          type: EPriceItemType.RETURN,
        }
      : null,
    services: [
      ...(droppointId
        ? [
            {
              label: 'หลายจุดส่ง',
              price: droppointPrice,
              cost: droppointCost,
              type: EPriceItemType.SERVICES,
              refId: droppointId,
            },
          ]
        : []),
      ...additionalServicesPricing.map((service) => ({ ...service, type: EPriceItemType.SERVICES })),
    ],
    discount: discountId
      ? {
          label: discountName,
          cost: 0,
          price: totalDiscount,
          type: EPriceItemType.DISCOUNT,
          refId: discountId,
        }
      : null,
    taxs: isTaxCalculation
      ? {
          label: whtName,
          cost: whtCost,
          price: whtPrice,
          type: EPriceItemType.TAX,
        }
      : null,
    subTotalCost: subTotalCost,
    subTotal: subTotalPrice,
    taxCost: whtCost,
    tax: whtPrice,
    totalCost: totalCost,
    total: totalPrice,
  }

  return {
    detail: _detail,
    editDetail: _editDetail,
    price: _price,
    cost: _cost,
    displayDistance,
    displayTime,
    returnDistance: returnDistanceMeter,
    distance: distanceMeter,
    routes: computeRoutes,
  }
}

export async function calculateExistingQuotation(
  data: UpdateShipmentInput,
  session?: ClientSession,
): Promise<EditQuotationResultPayload> {
  const { isRounded, locations, vehicleTypeId, shipmentId, discountId, serviceIds, quotation } = data

  const shipping: PriceEditorItemInput | undefined = quotation?.shipping
  const rounded: PriceEditorItemInput | undefined = quotation?.rounded
  const taxs: PriceEditorItemInput | undefined = quotation?.taxs
  const services: PriceEditorItemInput[] = quotation?.services

  const shipment = await ShipmentModel.findById(shipmentId).session(session)

  const latestQuotation = last(sortBy(shipment.quotations, ['createdAt'])) as Quotation | undefined
  let _isPaymentComplete = false
  if (latestQuotation) {
    if (shipment.paymentMethod === EPaymentMethod.CREDIT) {
      _isPaymentComplete = true
    } else {
      const quotationsPayment = await PaymentModel.findOne({ quotations: { $in: [latestQuotation._id] } }).session(
        session,
      )
      _isPaymentComplete = quotationsPayment?.status === EPaymentStatus.COMPLETE
    }
  }

  const vehicleCost = await VehicleCostModel.findByVehicleId(vehicleTypeId, session)
  if (!vehicleCost) {
    const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
    throw new GraphQLError(message, {
      extensions: { code: 'NOT_FOUND', errors: [{ message }] },
    })
  }

  const original = head(locations)
  const destinationsRaw = tail(locations).map((destination) => destination.location)
  const destinations = isRounded ? [...destinationsRaw, original.location] : destinationsRaw

  /**
   * Get Routes detail from Google APIs
   */
  const computeRoutes = await getRoute(original.location, destinations).catch((error) => {
    console.log(JSON.stringify(error, undefined, 2))
    throw error
  })
  const directionRoutes = head(computeRoutes.routes)

  const {
    displayDistance,
    displayTime,
    distance: distanceMeter,
    returnDistance: returnDistanceMeter,
  } = handleGetDistanceDetail(directionRoutes, vehicleCost.vehicleType as VehicleType, isRounded)

  const latestTotalPrice = get(latestQuotation, 'price', undefined) as Price | undefined
  const latestTotalCost = get(latestQuotation, 'cost', undefined) as Price | undefined

  /**
   * Additional Service Cost Pricng
   */
  const additionalServicesPricing = await Aigle.map<string, PriceEditorItem>(serviceIds, async (serviceId) => {
    const changedService = find(services, ['refId', serviceId])
    if (changedService) {
      return changedService
    }
    const service = find(shipment?.additionalServices || [], ['reference._id', serviceId]) as
      | ShipmentAdditionalServicePrice
      | undefined
    if (service) {
      const label = get(service, 'reference.additionalService.name', '')
      return {
        label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
        cost: service.cost,
        price: service.price,
        refId: serviceId,
        type: EPriceItemType.SERVICES,
      }
    } else {
      const newService = await AdditionalServiceCostPricingModel.findById(serviceId) //.session(session)
      if (newService) {
        const label = get(newService.additionalService, 'name', '')
        return {
          label: label === 'POD' ? `บริการคืนใบส่งสินค้า (POD)` : label,
          cost: newService.cost,
          price: newService.price,
          refId: newService._id,
          type: EPriceItemType.SERVICES,
        }
      } else {
        return {
          label: '',
          cost: 0,
          price: 0,
          type: EPriceItemType.SERVICES,
        }
      }
    }
  })

  /**
   * New Calculate before discount calculate
   */
  const newPreDiscountCost = sum([shipping.cost, rounded?.cost || 0, sumBy(additionalServicesPricing, 'cost') || 0])
  const newPreDiscountPrice = sum([shipping.price, rounded?.price || 0, sumBy(additionalServicesPricing, 'price') || 0])

  /**
   * New Discount
   */
  let newDiscountTotal: number | null = null
  let newDiscountName = ''
  if (discountId) {
    const { discountName, totalDiscount } = await PrivilegeModel.calculateDiscount(discountId, newPreDiscountPrice)
    newDiscountTotal = totalDiscount
    newDiscountName = discountName
  }

  const newSubTotal = sum([newPreDiscountPrice, -newDiscountTotal])

  const _user = shipment.customer as User

  /**
   * New Tax
   */
  const isBusinessUser = _user.userType === EUserType.BUSINESS
  let newTaxTotal: number = 0
  const newTaxCost: number = newPreDiscountCost * 0.01
  if (isBusinessUser) {
    const _tax = newSubTotal * 0.01
    newTaxTotal = _tax
  }

  const newTotal = sum([newSubTotal, -newTaxTotal])
  const newTotalCost = sum([newPreDiscountCost, -newTaxCost])

  const actureCostToPay = sum([
    newTotalCost,
    -(latestTotalCost?.total || 0),
    _isPaymentComplete ? 0 : latestTotalCost?.acturePrice || 0,
  ])
  const acturePriceToPay = sum([
    newTotal,
    -(latestTotalPrice?.total || 0),
    _isPaymentComplete ? 0 : latestTotalPrice?.acturePrice || 0,
  ])

  const _price: Price = {
    acturePrice: acturePriceToPay,
    droppoint: 0, // Can not get where comform
    rounded: rounded?.price || 0,
    roundedPercent: latestTotalPrice?.roundedPercent,
    subTotal: newSubTotal,
    tax: newTaxTotal,
    total: newTotal,
  }
  const _cost: Price = {
    acturePrice: actureCostToPay,
    droppoint: 0, // Can not get where comform
    rounded: rounded?.cost || 0,
    roundedPercent: latestTotalCost?.roundedPercent,
    subTotal: newPreDiscountCost,
    tax: newTaxCost,
    total: newTotalCost,
  }

  const _quotation: Partial<QuotationEditorDetail> = {
    shipping: {
      label: shipping.label,
      cost: shipping.cost,
      price: shipping.price,
      type: EPriceItemType.SHIPPING,
    },
    rounded: rounded
      ? {
          label: rounded.label,
          cost: rounded.cost,
          price: rounded.price,
          type: EPriceItemType.RETURN,
        }
      : null,
    services: additionalServicesPricing,
    discount: newDiscountTotal
      ? { label: newDiscountName, cost: 0, price: newDiscountTotal, type: EPriceItemType.DISCOUNT }
      : null,
    taxs: taxs ? { label: taxs.label, cost: newTaxCost, price: newTaxTotal, type: EPriceItemType.TAX } : null,
    subTotal: _price.subTotal,
    tax: _price.tax,
    total: _price.total,
    subTotalCost: _cost.subTotal,
    taxCost: _cost.tax,
    totalCost: _cost.total,
  }

  return {
    quotation: _quotation,
    displayDistance,
    displayTime,
    returnDistance: returnDistanceMeter,
    distance: distanceMeter,
    routes: computeRoutes,
    price: _price,
    cost: _cost,
  }
}

// Get distance
function handleGetDistanceDetail(route: google.maps.DirectionsRoute, vehicle: VehicleType, isRounded: boolean) {
  const legs = route?.legs
  const timeAnDistance = reduce(
    legs,
    (prev, curr) => {
      const distance = prev.distance + get(curr, 'distance.value', 0)
      const duration = prev.duration + get(curr, 'duration.value', 0)
      return { distance, duration }
    },
    { distance: 0, duration: 0 },
  )
  const originDistance = isRounded ? get(legs, '0.distance.value', 0) : timeAnDistance.distance
  const returnDistance = isRounded ? get(legs, '1.distance.value', 0) : 0

  const w4 = [1800, 2700] // 30s - 45s
  const other = [2700, 3600] // 45s - 60s

  // Make random time
  // const vehicleCost = find(vehicleCosts, ['vehicleType._id', vehicleId])
  const typeVehicle = vehicle.type
  const distanceTime = typeVehicle ? (typeVehicle === '4W' ? random(w4[0], w4[1]) : random(other[0], other[1])) : 0

  return {
    displayDistance: timeAnDistance.distance,
    displayTime: sum([timeAnDistance.duration, distanceTime]),
    distance: originDistance,
    returnDistance: returnDistance,
  }
}

export function calculateStep(distance: number, formula: DistanceCostPricing[]) {
  let _subTotalCost = 0
  let _subTotalPrice = 0
  const _calculations: CalculationResultPayload[] = []

  // Calculate for each distance
  forEach(formula, (step) => {
    if (distance >= step.from) {
      const stepTo = step.to === step.from ? Infinity : step.to
      const applicableDistance = Math.min(distance, stepTo ?? distance) - step.from + 1
      const calculatedCost = step.unit === EDistanceCostPricingUnit.KM ? step.cost * applicableDistance : step.cost
      const calculatedPrice = step.unit === EDistanceCostPricingUnit.KM ? step.price * applicableDistance : step.price

      _subTotalCost += calculatedCost
      _subTotalPrice += calculatedPrice

      _calculations.push({
        ...step,
        calculatedCost,
        calculatedPrice,
      })
    }
  })

  // Round UP for Decimal
  const _cost = ceil(_subTotalCost)
  const _price = ceil(_subTotalPrice)

  return {
    calculations: _calculations,
    cost: _cost,
    price: _price,
  }
}
