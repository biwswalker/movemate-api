import { BookingReport, generateBookingReport } from 'reports/excels/admin/booking'
import { fDate, fDateTime } from '@utils/formatTime'
import path from 'path'
import ShipmentModel from '@models/shipment.model'
import Aigle from 'aigle'
import lodash, { find, head, includes, last, reduce, sum, tail } from 'lodash'
import { User } from '@models/user.model'
import { EUserType } from '@enums/users'
import { EShipmentStatus } from '@enums/shipments'
import { EPaymentMethod } from '@enums/payments'
import { VehicleType } from '@models/vehicleType.model'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import { VALUES } from 'constants/values'
import { Quotation } from '@models/finance/quotation.model'
import ShipmentResolver from '@resolvers/shipment.resolvers'

Aigle.mixin(lodash, {})

function getShipmentStatus(status: EShipmentStatus) {
  switch (status) {
    case EShipmentStatus.IDLE:
      return 'รอเริ่มงาน'
    case EShipmentStatus.PROGRESSING:
      return 'กำลังดำเนินการ'
    case EShipmentStatus.CANCELLED:
      return 'ยกเลิก'
    case EShipmentStatus.DELIVERED:
      return 'สำเร็จ'
    case EShipmentStatus.REFUND:
      return 'คืนเงิน'
    default:
      return '-'
  }
}

function getPaymentType(status: EPaymentMethod) {
  switch (status) {
    case EPaymentMethod.CASH:
      return 'เงินสด'
    case EPaymentMethod.CREDIT:
      return 'เครดิต'
    default:
      return '-'
  }
}

function getAdditionalPrice(services: ShipmentAdditionalServicePrice[], value: string) {
  const _shipment = find(services, ['name', value])
  return _shipment
}

export async function getAdminBookingReport(query: any) {
  const bookingIds = await ShipmentModel.find().distinct('_id')
  const bookings = await ShipmentModel.find({ _id: { $in: bookingIds } })

  const workbookData: BookingReport[] = await Aigle.map(bookings, async (booking) => {
    const customer = booking.customer as User | undefined
    const origin = head(booking.destinations || [])
    const destinations = tail(booking.destinations || [])
    const vehicle = booking.vehicleId as VehicleType | undefined
    const additionalServices = (booking.additionalServices as ShipmentAdditionalServicePrice[]) || []
    const services = additionalServices.map((service) => service?.name ?? '-')

    // TODO: Check again
    const _shipmentResolver = new ShipmentResolver()
    const _calculated = await _shipmentResolver.getCalculationDetail(booking._id)

    const _quotation = last(booking.quotations) as Quotation
    const _cost = _quotation.cost
    const _price = _quotation.price
    const _discount = reduce(
      _quotation.detail.discounts || [],
      (prev, discount) => ({ cost: sum([prev.cost, discount.cost]), price: sum([prev.price, discount.price]) }),
      { cost: 0, price: 0 },
    )

    return {
      bookingDate: booking.createdAt ? fDate(booking.createdAt, 'dd/MM/yyyy HH:mm') : '',
      pickupDate: booking.bookingDateTime ? fDate(booking.bookingDateTime, 'dd/MM/yyyy HH:mm') : '',
      shipmentId: booking.trackingNumber ?? '-',
      customerName: customer.fullname ?? '-',
      customerId: customer.userNumber ?? '-',
      bookingBy: origin.contactName,
      customerType: customer.userType
        ? customer.userType === EUserType.BUSINESS
          ? 'Movemate Corporate'
          : 'Movemate Individual'
        : '-',
      email: customer.email ?? '-',
      tel: customer.contactNumber ?? '-',
      bookingStatus: getShipmentStatus(booking.status),
      paymentType: getPaymentType(booking.paymentMethod),
      truckType: vehicle.name ?? '-',
      roundTrip: booking.isRoundedReturn ? 'Yes' : 'No',
      multiRoute: destinations.length > 1 ? 'Yes' : 'No',
      distance: booking.displayDistance / 1000,
      pickup: origin.placeProvince,
      deliveries: destinations.map((destination) => destination.placeProvince),
      dropPoint: destinations.length,
      // SERVICE
      driverHelpService: includes(services, VALUES.DRIVER_CARRY) ? 'Yes' : 'No',
      addLaborService: includes(services, VALUES.ADDITIONAL_DRIVER) ? 'Yes' : 'No',
      podService: includes(services, VALUES.POD) ? 'Yes' : 'No',
      overnightService: includes(services, VALUES.OVERNIGHT) ? 'Yes' : 'No',
      // COST
      deliveryCost: _calculated.subTotalCost || null,
      roundTripCost: _calculated.subTotalRoundedCost || null,
      multiRouteCost: _calculated.subTotalDropPointCost || null,
      driverHelpCost: getAdditionalPrice(additionalServices, VALUES.DRIVER_CARRY)?.cost ?? null,
      addLaborCost: getAdditionalPrice(additionalServices, VALUES.ADDITIONAL_DRIVER)?.cost ?? null,
      podCost: getAdditionalPrice(additionalServices, VALUES.POD)?.cost ?? null,
      overnightCost: getAdditionalPrice(additionalServices, VALUES.OVERNIGHT)?.cost ?? null,
      // SELL
      deliverySell: _calculated.subTotalPrice || null,
      roundTripSell: _calculated.subTotalRoundedPrice || null,
      multiRouteSell: _calculated.subTotalDropPointPrice || null,
      driverHelpSell: getAdditionalPrice(additionalServices, VALUES.DRIVER_CARRY)?.price ?? null,
      addLaborSell: getAdditionalPrice(additionalServices, VALUES.ADDITIONAL_DRIVER)?.price ?? null,
      podSell: getAdditionalPrice(additionalServices, VALUES.POD)?.price ?? null,
      overnightSell: getAdditionalPrice(additionalServices, VALUES.OVERNIGHT)?.price ?? null,
      // TOTAL
      totalCost: _cost.subTotal,
      totalSell: _price.subTotal,
      discount: _discount.price,
      tax: _price.tax,
      total: _price.total,
      profit: sum([_price.total, -_cost.total]),
    }
  })

  const workbook = await generateBookingReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/booking',
    `booking-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)

  return filePath
}
