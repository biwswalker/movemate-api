import { Style, Workbook } from 'exceljs'

interface DebtorReport {
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
    overdueCount?: string
    paymentType?: string
    invoiceNo?: string
    invoiceTotal?: string
    invoiceDate?: string
    ajustmentDecreaseNo?: string
    ajustmentDecreaseTotal?: string
    ajustmentDecreaseDate?: string
    ajustmentIncreaseNo?: string
    ajustmentIncreaseTotal?: string
    ajustmentIncreaseDate?: string
    receiptNo?: string
    paymentDate?: string
    receiptDate?: string
}

export async function generateCreditorReport(data: DebtorReport[]): Promise<Workbook> {
  try {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Creditors')

    const _numberFormatStyle: Partial<Style> = { numFmt: '#,##0' }
    worksheet.columns = [
      { header: 'Customer ID', key: 'customerId', width: 25 },
      { header: 'Name', key: 'name', width: 12 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Customer Type', key: 'customerType', width: 15 },
      { header: 'TAX ID', key: 'taxId', width: 15 },
      { header: 'Address', key: 'address', width: 25 },
      { header: 'Email', key: 'email', width: 18 },
      { header: 'เบอร์โทรศัพท์', key: 'contactNumber', width: 20 },
      { header: 'รอบการใช้งาน', key: 'workingPeriod', width: 17 },
      { header: 'วันครบกำหนดชำระ', key: 'duedate', width: 28 },
      { header: 'สถานะชำระ', key: 'paymentStatus', width: 16 },
      { header: 'วันค้างชำระ', key: 'overdueCount', width: 16 },
      { header: 'Payment Type', key: 'paymentType', width: 16 },
      { header: 'เลขที่ใบแจ้งหนี้', key: 'invoiceNo', width: 16 },
      { header: 'มูลค่าใบแจ้งหนี้', key: 'invoiceTotal', width: 15 },
      { header: 'วันที่ใบแจ้งหนี้', key: 'invoiceDate', width: 20 },
      { header: 'เลขที่ใบลดหนี้', key: 'ajustmentDecreaseNo', width: 20 },
      { header: 'มูลค่าใบลดหนี้', key: 'ajustmentDecreaseTotal', width: 20 },
      { header: 'วันที่ใบลดหนี้', key: 'ajustmentDecreaseDate', width: 20 },
      { header: 'เลขที่ใบเพิ่มหนี้', key: 'ajustmentIncreaseNo', width: 20 },
      { header: 'มูลค่าใบเพิ่มหนี้', key: 'ajustmentIncreaseTotal', width: 20 },
      { header: 'วันที่ใบเพิ่มหนี้', key: 'ajustmentIncreaseDate', width: 20 },
      { header: 'Receipt No.', key: 'receiptNo', width: 20 },
      { header: 'Payment Date', key: 'paymentDate', width: 18, ..._numberFormatStyle },
      { header: 'Receipt Issue Date', key: 'receiptDate', width: 18, ..._numberFormatStyle },
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
