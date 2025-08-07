import { Workbook, Style } from 'exceljs'
import max from 'lodash/max'
import range from 'lodash/range'
import get from 'lodash/get'

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
        ...range(maxDestination).reduce(
          (prev, seq) => ({ ...prev, [`delivery${seq + 1}`]: get(deliveries, seq, '') }),
          {},
        ),
      }
      worksheet.addRow(_row)
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
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

interface CutomerDetailBookingReport {
  customerName: string
  branch: string
  customerId: string
  customerType: string
  email: string
  phoneNo: string
}

export async function generateCustomerBookingReport(
  data: BookingReport[],
  userDetail: CutomerDetailBookingReport,
): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Bookings')
    const boldStyle = { font: { bold: true } }

    // --- 1. เพิ่มข้อมูลสรุปลูกค้า (User Detail) ไว้ด้านบนสุด ---
    worksheet.addRow(['Customer Name:', userDetail.customerName, '', 'Email:', userDetail.email])
    worksheet.getRow(1).getCell(1).font = boldStyle.font
    worksheet.getRow(1).getCell(4).font = boldStyle.font
    worksheet.addRow(['Branch:', userDetail.branch, '', 'Phone No.:', userDetail.phoneNo])
    worksheet.getRow(2).getCell(1).font = boldStyle.font
    worksheet.getRow(2).getCell(4).font = boldStyle.font
    worksheet.addRow(['Customer ID:', userDetail.customerId])
    worksheet.getRow(3).getCell(1).font = boldStyle.font
    worksheet.addRow(['Customer Type:', userDetail.customerType])
    worksheet.getRow(4).getCell(1).font = boldStyle.font
    worksheet.addRow([])

    const maxDestination = max(data.map((dest) => (dest.deliveries || []).length))
    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0.00' }
    const tableHeaderRow = worksheet.getRow(6)
    const headers = [
      'Booking Date/Time',
      'Pickup Date/Time',
      'Shipment ID',
      'Booking By',
      'Booking Status',
      'Payment Type',
      'Truck Type',
      'Round-Trip (ไป-กลับ)',
      'Multi Route',
      'Distance',
      'Pickup 1',
      ...range(maxDestination).map((seq) => `Delivery ${seq + 1}`),
      'Drop Point',
      'Total Cost',
      'Total Discount',
      'Total Charge',
    ]
    tableHeaderRow.values = headers
    tableHeaderRow.height = 20
    tableHeaderRow.font = { bold: true, size: 12 }
    tableHeaderRow.alignment = { vertical: 'bottom', horizontal: 'center' }
    const columnWidths = [20, 20, 20, 20, 18, 13, 20, 17, 10, 14, 20]
    const deliveryWidths = Array(maxDestination).fill(20)
    const finalWidths = [10, 15, 15, 15]
    ;[...columnWidths, ...deliveryWidths, ...finalWidths].forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width
    })
    worksheet.getColumn(8).alignment = { horizontal: 'center', vertical: 'middle' } // Round-Trip
    worksheet.getColumn(9).alignment = { horizontal: 'center', vertical: 'middle' } // Multi Route
    worksheet.getColumn(10).style = { ...worksheet.getColumn(10).style, ..._numberFormatStyle } // Distance
    worksheet.getColumn(13 + maxDestination).style = {
      ...worksheet.getColumn(13 + maxDestination).style,
      ..._numberFormatStyle,
    } // Total Cost
    worksheet.getColumn(14 + maxDestination).style = {
      ...worksheet.getColumn(14 + maxDestination).style,
      ..._numberFormatStyle,
    } // Total Discount
    worksheet.getColumn(15 + maxDestination).style = {
      ...worksheet.getColumn(15 + maxDestination).style,
      ..._numberFormatStyle,
    } // Total Charge

    data.forEach(({ deliveries, ...item }) => {
      const _row = [
        item.bookingDate,
        item.pickupDate,
        item.shipmentId,
        item.bookingBy,
        item.bookingStatus,
        item.paymentType,
        item.truckType,
        item.roundTrip,
        item.multiRoute,
        item.distance,
        item.pickup,
        ...range(maxDestination).reduce((prev, seq) => [...prev, get(deliveries, seq, '')], []),
        item.dropPoint,
        item.totalSell,
        item.discount,
        item.total,
      ]
      worksheet.addRow(_row)
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 6) {
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
