import PDFDocument, { DataOptions, Data } from 'pdfkit-table'
import fs from 'fs'
import path from 'path'
import { ClientSession } from 'mongoose'
import { FONTS } from './components/constants'
import { renderWHTContent } from './components/wht'
import { fDate } from '@utils/formatTime'
import { fCurrency } from '@utils/formatNumber'
import { DriverPayment } from '@models/driverPayment.model'
import BillingDocumentModel, { BillingDocument } from '@models/finance/documents.model'
import { User } from '@models/user.model'
import { EUserType } from '@enums/users'

interface GenerateWHTCertResponse {
  fileName: string
  filePath: string
  document: BillingDocument
}

export async function generateWHTCert(
  driverPayment: DriverPayment,
  filename?: string,
  session?: ClientSession,
): Promise<GenerateWHTCertResponse> {
  const fileName = filename ? filename : `wht_${driverPayment.paymentNumber}.pdf`
  const filePath = path.join(__dirname, '..', '..', 'generated/whtcert', fileName)

  const driverInfo = driverPayment.driver as User | undefined
  // TODO: Add info

  /**
   * Input data
   */
  const _whtBookNo = driverPayment.whtBookNo || '-'
  const _whtNumber = driverPayment.whtNumber || '-'
  const _fullname = driverInfo.fullname || '-'
  const _isBusinessCustomer = driverInfo.userType === EUserType.BUSINESS
  const _taxId = driverInfo.taxId || '-'
  const _fullAddress = driverInfo.address || '-'

  // Table
  const _paidDate = fDate(new Date(driverPayment.paymentDate), 'dd/MM/yyyy')
  const _subTotalBaht = driverPayment.subtotal
  const _subTotalWHT = driverPayment.tax
  const _totalBaht = driverPayment.subtotal
  const _totalWHT = driverPayment.tax

  const _doc = new PDFDocument({
    size: 'A4',
    margins: { top: 22, bottom: 22, left: 22, right: 22 },
    autoFirstPage: false,
  })

  const _writeStream = fs.createWriteStream(filePath)
  _doc.pipe(_writeStream)
  _doc.addPage()

  const options: DataOptions = {
    fontFamily: FONTS.SARABUN_LIGHT,
    fontSize: 7,
    separation: false,
  }

  const _datas: Data[] = [
    {
      details: {
        label: '  1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ  ตามมาตรา 40 (1)',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '  2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '  3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '  4. (ก) ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '      (ข) เงินปันผล ส่วนแบ่งของกำไร ฯลฯ ตามมาตรา 40 (4) (ข)',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '          (1) กรณีผู้ด้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจาก',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '               กำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '                  (1.1) อัตราร้อยละ 30 ของกำไรสุทธิ', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '                  (1.2) อัตราร้อยละ 25 ของกำไรสุทธิ', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '                  (1.3) อัตราร้อยละ 20 ของกำไรสุทธิ', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '                  (1.1) อัตราร้อยละ 30 ของกำไรสุทธิ', options: { ...options, align: 'left' } },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                  (1.4) อัตราอื่นๆ (ระบุ)_______________________________ของกำไรสุทธิ',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '          (2) กิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคลซึ่ง ผู้รับเงินปันผลไม่ได้รับเครดิตภาษี',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                  (2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                  (2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวม',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                          คำนวณเป็นรายได้เพื่อเสียภาษีนิติบุคคล',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                  (2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                          ก่อนรอบระยะเวลาบัญชีปัจจุบัน',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '                  (2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label:
          '                  (2.5) อัตราอื่นๆ (ระบุ)_______________________________________________________________________________________________________________',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '  5. การจ่ายเงินได้ที่ต้องหักภาษี ณ. ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตาม',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label: '      มาตรา 3 เตรส (ระบุ)______________________________ค่าขนส่ง______________________________',
        options: { ...options, align: 'left' },
      },
      date: { label: _paidDate, options },
      total: { label: fCurrency(_subTotalBaht, true), options },
      wht: { label: fCurrency(_subTotalWHT, true), options },
    },
    {
      details: {
        label: '      (เช่น รางวัล ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย  ในการประกวด การแข่งขัน การชิงโชค',
        options: { ...options, fontSize: 7, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label:
          '      ค่าแสดงของนักแสดงสาธารณะ ค่าบริการ ค่าขนส่ง ค่าจ้างทำของ ค่าจ้างโฆษณา ค่าเช่า ค่าเบี้ยประกันวินาศภัย ฯลฯ',
        options: { ...options, fontSize: 7, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: {
        label:
          '  6. อื่นๆ(ระบุ)_______________________________________________________________________________________________________________________________________',
        options: { ...options, align: 'left' },
      },
      date: { label: '', options },
      total: { label: '', options },
      wht: { label: '', options },
    },
    {
      details: { label: '' },
      date: { label: '' },
      total: { label: fCurrency(_totalBaht, true), options },
      wht: { label: fCurrency(_totalWHT, true), options },
    },
  ]

  const _whtInfo = {
    totalBaht: _totalBaht,
    whtBookNo: _whtBookNo,
    whtNumber: _whtNumber,
    fullname: _fullname,
    isBusinessCustomer: _isBusinessCustomer,
    taxId: _taxId,
    fullAddress: _fullAddress,
  }

  await renderWHTContent(_doc, _whtInfo, _datas)

  _doc.addPage()

  await renderWHTContent(_doc, _whtInfo, _datas)

  _doc.end()
  await new Promise((resolve) => _writeStream.on('finish', resolve))

  const _document = driverPayment.document as BillingDocument | undefined
  if (_document) {
    const _updatedDocument = await BillingDocumentModel.findByIdAndUpdate(
      _document._id,
      { filename: fileName },
      { session, new: true },
    )
    return { fileName, filePath, document: _updatedDocument }
  } else {
    const _document = new BillingDocumentModel({ filename: fileName })
    await _document.save({ session })
    return { fileName, filePath, document: _document }
  }
}
