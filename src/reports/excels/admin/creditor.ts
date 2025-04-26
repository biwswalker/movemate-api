import { Style, Workbook } from 'exceljs'
import { head, tail } from 'lodash'

interface ShipmentCreditorReport {
  shipmentNo?: string
  finishedDate?: string
  value?: number
}
export interface CreditorReport {
  userId?: string
  userType?: string
  fullname?: string
  branch?: string
  taxId?: string
  address?: string
  email?: string
  contactNumber?: string
  workingPeriod?: string
  duedate?: string
  overdueCount?: string
  shipments?: ShipmentCreditorReport[]
  subtotal?: number
  whtValue?: number
  total?: number
  paymentDate?: string
  receiptNo?: string
  whtNo?: string
}

export async function generateCreditorReport(data: CreditorReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Creditors')

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0.00' }
    worksheet.columns = [
      { header: 'User ID', key: 'userId', width: 25 },
      { header: 'User Type', key: 'userType', width: 12 },
      { header: 'Name', key: 'fullname', width: 20 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'TAX ID/ID', key: 'taxId', width: 15 },
      { header: 'Address', key: 'address', width: 25 },
      { header: 'Email', key: 'email', width: 18 },
      { header: 'เบอร์โทรศัพท์', key: 'contactNumber', width: 20 },
      { header: 'รอบการวิ่งงาน', key: 'workingPeriod', width: 17 },
      { header: 'วันครบกำหนดชำระ', key: 'duedate', width: 28 },
      { header: 'วันค้างชำระ', key: 'overdueCount', width: 16 },
      { header: 'Shipment No.', key: 'shipmentNo', width: 16 },
      { header: 'วันที่งานเสร็จสิ้น', key: 'finishedDate', width: 15 },
      { header: 'มูลค่า', key: 'value', width: 20, style: _numberFormatStyle },
      { header: 'มูลค่าที่ต้องชำระ', key: 'subtotal', width: 20, style: _numberFormatStyle },
      { header: 'ภาษีหัก ณ ที่จ่าย 1%', key: 'whtValue', width: 20, style: _numberFormatStyle },
      { header: 'มูลค่าที่ต้องชำระสุทธิ', key: 'total', width: 18, style: _numberFormatStyle },
      { header: 'Payment Date', key: 'paymentDate', width: 18 },
      { header: 'Receipt/Payment Voucher No.', key: 'receiptNo', width: 18 },
      { header: 'WHT No.', key: 'whtNo', width: 18 },
    ]
    worksheet.getRow(1).height = 20
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).alignment = { vertical: 'bottom', horizontal: 'center' }

    data.forEach((item) => {
      item.shipments
      const { shipmentNo, finishedDate, value } = head(item.shipments) || {}
      const _shipments = tail(item.shipments) || []
      worksheet.addRow({ ...item, shipmentNo, finishedDate, value })
      _shipments.forEach(({ shipmentNo: _shipmentNo, finishedDate: _finishedDate, value: _value }) => {
        worksheet.addRow({ shipmentNo: _shipmentNo, finishedDate: _finishedDate, value: _value })
      })
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
