import { Style, Workbook } from 'exceljs'

export interface DebtorReport {
    customerId?: string
    name?: string
    branch?: string
    customerType?: string
    taxId?: string
    address?: string
    email?: string
    contactNumber?: string
    workingPeriod?: string
    duedate?: string
    paymentStatus?: string
    overdueCount?: number
    paymentType?: string
    invoiceNo?: string
    invoiceTotal?: number
    invoiceDate?: string
    ajustmentDecreaseNo?: string
    ajustmentDecreaseTotal?: number
    ajustmentDecreaseDate?: string
    ajustmentIncreaseNo?: string
    ajustmentIncreaseTotal?: number
    ajustmentIncreaseDate?: string
    receiptNo?: string
    paymentDate?: string
    receiptDate?: string
}

export async function generateDebtorReport(data: DebtorReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Debtors')

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0' }
    const _numberFormatDecimalStyle: Partial<Style> = { numFmt: '#,##0.00' }
    worksheet.columns = [
      { header: 'Customer ID', key: 'customerId', width: 14 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Branch', key: 'branch', width: 25 },
      { header: 'Customer Type', key: 'customerType', width: 18.3 },
      { header: 'TAX ID', key: 'taxId', width: 15 },
      { header: 'Address', key: 'address', width: 58 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'เบอร์โทรศัพท์', key: 'contactNumber', width: 13.3 },
      { header: 'รอบการใช้งาน', key: 'workingPeriod', width: 25 },
      { header: 'วันครบกำหนดชำระ', key: 'duedate', width: 25 },
      { header: 'สถานะชำระ', key: 'paymentStatus', width: 25 },
      { header: 'วันค้างชำระ', key: 'overdueCount', width: 10.7, style: _numberFormatStyle },
      { header: 'Payment Type', key: 'paymentType', width: 14.4 },
      { header: 'เลขที่ใบแจ้งหนี้', key: 'invoiceNo', width: 16 },
      { header: 'มูลค่าใบแจ้งหนี้', key: 'invoiceTotal', width: 15, style: _numberFormatDecimalStyle },
      { header: 'วันที่ใบแจ้งหนี้', key: 'invoiceDate', width: 25 },
      { header: 'เลขที่ใบลดหนี้', key: 'ajustmentDecreaseNo', width: 20 },
      { header: 'มูลค่าใบลดหนี้', key: 'ajustmentDecreaseTotal', width: 20, style: _numberFormatDecimalStyle },
      { header: 'วันที่ใบลดหนี้', key: 'ajustmentDecreaseDate', width: 25 },
      { header: 'เลขที่ใบเพิ่มหนี้', key: 'ajustmentIncreaseNo', width: 20 },
      { header: 'มูลค่าใบเพิ่มหนี้', key: 'ajustmentIncreaseTotal', width: 20, style: _numberFormatDecimalStyle },
      { header: 'วันที่ใบเพิ่มหนี้', key: 'ajustmentIncreaseDate', width: 25 },
      { header: 'Receipt No.', key: 'receiptNo', width: 20 },
      { header: 'Payment Date', key: 'paymentDate', width: 25 },
      { header: 'Receipt Issue Date', key: 'receiptDate', width: 25 },
      { header: 'WHT No.', key: 'whtNo', width: 20 },
    ]
    worksheet.getRow(1).height = 20
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).alignment = { vertical: 'bottom', horizontal: 'center' }

    data.forEach((item) => {
      worksheet.addRow(item)
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
