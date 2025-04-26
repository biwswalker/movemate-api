import { Workbook, Style } from 'exceljs'
import max from 'lodash/max'
import range from 'lodash/range'
import get from 'lodash/get'
import { width } from 'pdfkit/js/page'

export interface BookingReport {
  bookingDate?: string
  pickupDate?: string
  shipmentId?: string
  customerName?: string
  customerId?: string
  bookingBy?: string
  customerType?: string
  email?: string
  tel?: string
  bookingStatus?: string
  paymentType?: string
  truckType?: string
  roundTrip?: string
  multiRoute?: string
  distance?: number
  pickup?: string
  deliveries?: string[]
  dropPoint?: number
  // SERVICE
  driverHelpService?: string
  addLaborService?: string
  podService?: string
  overnightService?: string
  // COST
  deliveryCost?: number
  roundTripCost?: number
  multiRouteCost?: number
  driverHelpCost?: number
  addLaborCost?: number
  podCost?: number
  overnightCost?: number
  // SELL
  deliverySell?: number
  roundTripSell?: number
  multiRouteSell?: number
  driverHelpSell?: number
  addLaborSell?: number
  podSell?: number
  overnightSell?: number
  // TOTAL
  totalCost?: number
  totalSell?: number
  discount?: number
  total?: number
  tax?: number
  profit?: number
}

export async function generateBookingReport(data: BookingReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Bookings')

    const maxDestination = max(data.map((dest) => (dest.deliveries || []).length))

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0.00' }
    worksheet.columns = [
      { header: 'Booking Date/Time', key: 'bookingDate', width: 20 },
      { header: 'Pickup Date/Time', key: 'pickupDate', width: 20 },
      { header: 'Shipment ID', key: 'shipmentId', width: 20 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Customer ID', key: 'customerId', width: 20 },
      { header: 'Booking By', key: 'bookingBy', width: 20 },
      { header: 'Customer Type', key: 'customerType', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Tel', key: 'tel', width: 11 },
      { header: 'Booking Status', key: 'bookingStatus', width: 18 },
      { header: 'Payment Type', key: 'paymentType', width: 13 },
      { header: 'Truck Type', key: 'truckType', width: 20 },
      { header: 'Round-Trip (ไป-กลับ)', key: 'roundTrip', width: 17, style: { alignment: { horizontal: 'center' } } },
      { header: 'Multi Route', key: 'multiRoute', width: 10, style: { alignment: { horizontal: 'center' } } },
      { header: 'Distance', key: 'distance', width: 14, style: _numberFormatStyle },
      { header: 'Pickup 1', key: 'pickup', width: 20 },
      ...range(maxDestination).map((seq) => ({
        header: `Delivery ${seq + 1}`,
        key: `delivery${seq + 1}`,
        width: 20,
      })),
      { header: 'Drop Point', key: 'dropPoint', width: 10 },
      // Service Flag
      { header: 'Driver Help', key: 'driverHelpService', width: 10, style: { alignment: { horizontal: 'center' } } },
      { header: 'Add Labor', key: 'addLaborService', width: 10, style: { alignment: { horizontal: 'center' } } },
      { header: 'POD', key: 'podService', width: 10, style: { alignment: { horizontal: 'center' } } },
      { header: 'Overnight', key: 'overnightService', width: 12, style: { alignment: { horizontal: 'center' } } },
      // Cost
      { header: 'Delivery Cost', key: 'deliveryCost', width: 15, style: _numberFormatStyle },
      { header: 'Round-Trip Cost', key: 'roundTripCost', width: 15, style: _numberFormatStyle },
      { header: 'Multi Route Cost', key: 'multiRouteCost', width: 15, style: _numberFormatStyle },
      { header: 'Driver Help Cost', key: 'driverHelpCost', width: 15, style: _numberFormatStyle },
      { header: 'Add Labor Cost', key: 'addLaborCost', width: 15, style: _numberFormatStyle },
      { header: 'POD Cost', key: 'podCost', width: 15, style: _numberFormatStyle },
      { header: 'Overnight Cost', key: 'overnightCost', width: 15, style: _numberFormatStyle },
      // Sell
      { header: 'Delivery Sell', key: 'deliverySell', width: 15, style: _numberFormatStyle },
      { header: 'Round-Trip Sell', key: 'roundTripSell', width: 15, style: _numberFormatStyle },
      { header: 'Multi Route Sell', key: 'multiRouteSell', width: 15, style: _numberFormatStyle },
      { header: 'Driver Help Sell', key: 'driverHelpSell', width: 15, style: _numberFormatStyle },
      { header: 'Add Labor Sell', key: 'addLaborSell', width: 15, style: _numberFormatStyle },
      { header: 'POD Sell', key: 'podSell', width: 15, style: _numberFormatStyle },
      { header: 'Overnight Sell', key: 'overnightSell', width: 15, style: _numberFormatStyle },
      // Total
      { header: 'ต้นทุนรวม', key: 'totalCost', width: 15, style: _numberFormatStyle },
      { header: 'ราคาขายรวม', key: 'totalSell', width: 15, style: _numberFormatStyle },
      { header: 'มูลค่าส่วนลด', key: 'discount', width: 15, style: _numberFormatStyle },
      { header: 'หัก ณ ที่จ่าย', key: 'tax', width: 15, style: _numberFormatStyle },
      { header: 'ราคาขายหลังหักส่วนลด', key: 'total', width: 15, style: _numberFormatStyle },
      { header: 'Profit', key: 'profit', width: 15, style: _numberFormatStyle },
    ]
    worksheet.getRow(1).height = 20
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).alignment = { vertical: 'bottom', horizontal: 'center' }

    data.forEach(({ deliveries, ...item }) => {
      const _row = {
        ...item,
        ...range(maxDestination).reduce((prev, seq) => ({ ...prev, [`delivery${seq + 1}`]: get(deliveries, seq, '') }), {}),
      }
      worksheet.addRow(_row)
    })

    worksheet.eachRow((row, rowNumber) => {
      if(rowNumber > 1) {
        row.height = 16
        row.font = { size: 12 }
      }
    })

    return workbook
  } catch (error) {
    console.error(error)
    throw error
  }
}
