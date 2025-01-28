import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import { CalculationInput, UpdateShipmentInput } from '@inputs/booking.input'
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
import { find, forEach, get, head, last, min, omit, random, reduce, sortBy, sum, tail } from 'lodash'
import { getAdditionalServicePrice } from './servicces'
import Aigle from 'aigle'
import { EPrivilegeDiscountUnit } from '@enums/privilege'
import PrivilegeModel from '@models/privilege.model'
import { EUserType } from '@enums/users'
import UserModel from '@models/user.model'
import { fNumber } from '@utils/formatNumber'
import { Price, PriceItem, QuotationDetail, QuotationEditorDetail } from '@models/finance/objects'
import { ClientSession } from 'mongoose'
import { CalculateQuotationResultPayload } from '@payloads/quotation.payloads'
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
  let discountName = ''
  let totalDiscount = 0
  if (discountId) {
    const privilege = await PrivilegeModel.findById(discountId)
    const { name, unit, discount, minPrice, maxDiscountPrice } = privilege
    const isPercent = unit === EPrivilegeDiscountUnit.PERCENTAGE
    if (subTotalPrice >= minPrice) {
      if (isPercent) {
        const discountAsBath = (discount / 100) * subTotalPrice
        const maxDiscountAsBath = maxDiscountPrice ? min([maxDiscountPrice, discountAsBath]) : discountAsBath
        totalDiscount = maxDiscountAsBath
      } else {
        totalDiscount = discount
      }
    } else {
      totalDiscount = 0
    }
    discountName = `${name} (${discount}${
      unit === EPrivilegeDiscountUnit.CURRENCY ? ' บาท' : unit === EPrivilegeDiscountUnit.PERCENTAGE ? '%' : ''
    })`
  }

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
    isTaxCalculation = customerTypes === EUserType.BUSINESS && subTotalPrice > 1000
    if (isTaxCalculation) {
      whtName = 'ค่าภาษีบริการขนส่งสินค้าจากบริษัท 1% (WHT)'
      whtPrice = subTotalAfterDiscountPrice * 0.01
    }
  }

  const vehicleName = get(vehicleCost, 'vehicleType.name', '')
  const distanceKMText = fNumber(distanceKM, '0.0')
  const distanceReturnKMText = fNumber(distanceReturnKM, '0.0')

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
        label: `${vehicleName} (${fNumber(distanceKMText)} กม.)`,
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
    discounts: discountId
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
): Promise<{
  quotation: Partial<Quotation>
  displayDistance: number
  displayTime: number
  returnDistance: number
  distance: number
  routes: google.maps.DirectionsResult
}> {
  const { isRounded, locations, vehicleTypeId, shipmentId, quotation } = data

  const {
    shipping,
    rounded,
    services,
    discounts,
    taxs,
    // Float
    subTotal,
    subTotalCost,
    taxCost,
    totalCost,
    tax,
    total,
  } = quotation

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

  const actureCostToPay = sum([
    totalCost,
    -(latestTotalCost?.total || 0),
    _isPaymentComplete ? 0 : latestTotalCost?.acturePrice || 0,
  ])
  const acturePriceToPay = sum([
    total,
    -(latestTotalPrice?.total || 0),
    _isPaymentComplete ? 0 : latestTotalPrice?.acturePrice || 0,
  ])

  const _price: Price = {
    acturePrice: acturePriceToPay,
    droppoint: 0, // Can not get where comform
    rounded: rounded?.price || 0,
    roundedPercent: latestTotalPrice?.roundedPercent,
    subTotal: subTotal,
    tax: tax,
    total: total,
  }
  const _cost: Price = {
    acturePrice: actureCostToPay,
    droppoint: 0, // Can not get where comform
    rounded: rounded?.cost,
    roundedPercent: latestTotalCost?.roundedPercent,
    subTotal: subTotalCost,
    tax: taxCost,
    total: totalCost,
  }

  const _quotation: Partial<Quotation> = {
    cost: _cost,
    price: _price,
    detail: {
      shippingPrices: [
        { label: shipping.label, cost: shipping.cost, price: shipping.price },
        ...(rounded ? [{ label: rounded.label, cost: rounded.cost, price: rounded.price }] : []),
      ],
      additionalServices: services.map((service) => omit(service, ['refId', 'type'])),
      discounts: discounts ? [{ label: discounts.label, cost: discounts.cost, price: discounts.price }] : [],
      taxs: taxs ? [{ label: taxs.label, cost: taxs.cost, price: taxs.price }] : [],
      subTotal,
      tax,
      total,
    },
    subTotal,
    tax,
    total,
  }

  return {
    quotation: _quotation,
    displayDistance,
    displayTime,
    returnDistance: returnDistanceMeter,
    distance: distanceMeter,
    routes: computeRoutes,
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

  return {
    calculations: _calculations,
    cost: _subTotalCost,
    price: _subTotalPrice,
  }
}
