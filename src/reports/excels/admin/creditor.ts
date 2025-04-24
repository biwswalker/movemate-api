import { Style, Workbook } from 'exceljs'

interface CreditorReport {
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
  shipmentNo?: string
  completeDate?: string
  value?: string
  subtotal?: string
  whtValue?: string
  total?: string
  paymentDate?: string
  receiptNo?: string
  whtNo?: string
}

export async function generateCreditorReport(data: CreditorReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Creditors')

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0' }
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
      { header: 'วันที่งานเสร็จสิ้น', key: 'completeDate', width: 15 },
      { header: 'มูลค่า', key: 'value', width: 20 },
      { header: 'มูลค่าที่ต้องชำระ', key: 'subtotal', width: 20 },
      { header: 'ภาษีหัก ณ ที่จ่าย 1%', key: 'whtValue', width: 20 },
      { header: 'มูลค่าที่ต้องชำระสุทธิ', key: 'total', width: 18, ..._numberFormatStyle },
      { header: 'Payment Date', key: 'paymentDate', width: 18, ..._numberFormatStyle },
      { header: 'Receipt/Payment Voucher No.', key: 'receiptNo', width: 18, ..._numberFormatStyle },
      { header: 'WHT No.', key: 'whtNo', width: 18, ..._numberFormatStyle },
    ]
    worksheet.getRow(1).height = 20
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).alignment = { vertical: 'bottom', horizontal: 'center' }

    // TODO:
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
