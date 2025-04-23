import { Style, Workbook } from 'exceljs'

export interface CustomerReport {
  fullname?: string
  userNumber?: string
  userType?: string
  taxId?: string
  contactNumber?: string
  email?: string
  province?: string
  address?: string
  branch?: string
  businessType?: string
  approvalStatus?: string
  status?: string
  paymentMethod?: string
  registeredDate?: string
  lastActiveDate?: string
  lastBooked?: string
  totalShipment?: number
  success?: number
  cancelledCustomer?: number
  cancelledDriver?: number
  cancelledAdmin?: number
}

export async function generateCustomerReport(data: CustomerReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Customers')
    
    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0' }
    worksheet.columns = [
      { header: 'User Name', key: 'fullname', width: 25 },
      { header: 'Customer ID', key: 'userNumber', width: 12 },
      { header: 'User Type', key: 'userType', width: 20 },
      { header: 'TAX ID', key: 'taxId', width: 20 },
      { header: 'Phone No.', key: 'contactNumber', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Province', key: 'province', width: 18 },
      { header: 'Full Address', key: 'address', width: 20 },
      { header: 'Branch', key: 'branch', width: 17 },
      { header: 'Business Type', key: 'businessType', width: 28 },
      { header: 'Account Status', key: 'approvalStatus', width: 16 },
      { header: 'Active Status', key: 'status', width: 16 },
      { header: 'Payment Type', key: 'paymentMethod', width: 15 },
      { header: 'Registered Date', key: 'registeredDate', width: 20 },
      { header: 'Last Active Date', key: 'lastActiveDate', width: 20 },
      { header: 'Last Booked', key: 'lastBooked', width: 20 },
      { header: 'Total Shipment', key: 'totalShipment', width: 18, ..._numberFormatStyle },
      { header: 'Shipment Success', key: 'success', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Customer', key: 'cancelledCustomer', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Driver', key: 'cancelledDriver', width: 18, ..._numberFormatStyle },
      { header: 'Cancel By Admin', key: 'cancelledAdmin', width: 18, ..._numberFormatStyle },
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
