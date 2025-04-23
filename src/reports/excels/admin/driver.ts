import { Style, Workbook } from 'exceljs'

export interface DriverReport {
  driverId?: string
  fullname?: string
  userType?: string
  haveAgent?: string
  contactNumber?: string
  lineId?: string
  email?: string
  status?: string
  vehicleType?: string
  licensePlate?: string
  registeredDate?: string
  lastActiveDate?: string
  lastShipmentDate?: string
  totalShipment?: number
  success?: number
  cancelledCustomer?: number
  cancelledDriver?: number
  cancelledAdmin?: number
  bankAccount?: string
  bankAccountNumber?: string
}

export async function generateDriverReport(data: DriverReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Drivers')

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0' }
    worksheet.columns = [
      { header: 'Driver ID', key: 'driverId', width: 12 },
      { header: 'Driver Name', key: 'fullname', width: 25 },
      { header: 'Driver Type', key: 'userType', width: 12 },
      { header: 'Have Agent', key: 'haveAgent', width: 25 },
      { header: 'Phone No.', key: 'contactNumber', width: 15 },
      { header: 'Line ID', key: 'lineId', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Account Status', key: 'status', width: 18 },
      { header: 'Truck Type', key: 'vehicleType', width: 23 },
      { header: 'License Plate No.', key: 'licensePlate', width: 18 },
      { header: 'Registed Date', key: 'registeredDate', width: 18 },
      { header: 'Last Active Date', key: 'lastActiveDate', width: 18 },
      { header: 'Last Shipment Date', key: 'lastShipmentDate', width: 18 },
      { header: 'Total Shipment', key: 'totalShipment', width: 18, ..._numberFormatStyle },
      { header: 'Shipment Success', key: 'success', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Customer', key: 'cancelledCustomer', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Driver', key: 'cancelledDriver', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Admin', key: 'cancelledAdmin', width: 18, ..._numberFormatStyle },
      { header: 'Bank Account', key: 'bankAccount', width: 18 },
      { header: 'Bank Account Number', key: 'bankAccountNumber', width: 20 },
    ]

    worksheet.getRow(1).height = 20
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).alignment = { vertical: 'bottom', horizontal: 'center' }

    data.forEach((item) => {
      worksheet.addRow(item)
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 15
        row.font = { size: 12 }
      }
    })

    return workbook
  } catch (error) {
    console.error(error)
    throw error
  }
}
