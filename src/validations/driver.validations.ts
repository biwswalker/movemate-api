import { isEqual } from 'lodash'
import Yup from './yup'
import DriverDetailModel from '@models/driverDetail.model'

export const IndividualDriverScema = Yup.object().shape({
  policyVersion: Yup.number(),
  driverType: Yup.string(),
  title: Yup.string().required('กรุณาเลือกคำนำหน้าชื่อ'),
  otherTitle: Yup.string().when('title', ([title], schema) =>
    isEqual(title, 'อื่นๆ') ? schema.required('ระบุคำนำหน้าชื่อ') : schema.notRequired(),
  ),
  firstname: Yup.string()
    .required('ระบุชื่อ')
    .matches(/^[ก-๙\s]+$/, 'ระบุเป็นภาษาไทยเท่านั้น'),
  lastname: Yup.string()
    .required('ระบุนามสกุล')
    .matches(/^[ก-๙\s]+$/, 'ระบุเป็นภาษาไทยเท่านั้น'),
  taxNumber: Yup.string()
    .matches(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
    .min(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
    .max(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก'),
  phoneNumber: Yup.string()
    .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
    .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .required('ระบุหมายเลขโทรศัพท์')
    .test('exiting-phonenumber', 'หมายเลขโทรศัพท์ถูกใช้งานแล้ว', async (value) => {
      const existingDriver = await DriverDetailModel.findOne({ phoneNumber: value })
      return !existingDriver
    }),
  lineId: Yup.string(), //.required('ระบุไลน์ไอดี'),
  address: Yup.string().required('ระบุที่อยู่'),
  province: Yup.string().required('ระบุจังหวัด'),
  district: Yup.string().required('ระบุอำเภอ/แขวง'),
  subDistrict: Yup.string().required('ระบุตำบล/เขต'),
  postcode: Yup.string().required('ระบุรหัสไปรษณีย์').min(5, 'รหัสไปรษณีย์ 5 หลัก').max(5, 'รหัสไปรษณีย์ 5 หลัก'),
  bank: Yup.string().required('ระบุธนาคารที่ชำระ'),
  bankBranch: Yup.string()
    .required('ระบุชื่อสาขาธนาคาร')
    .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
  bankName: Yup.string()
    .required('ระบุชื่อบัญชี')
    .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
  bankNumber: Yup.string()
    .required('ระบุเลขที่บัญชี')
    .matches(/^[0-9\s]+$/g, 'ตัวเลขเท่านั้น')
    .min(10, 'ตัวเลขขั้นต่ำ 10 หลัก')
    .max(15, 'ตัวเลขสูงสุด 15 หลัก'),
  serviceVehicleTypes: Yup.array().min(1, 'ระบุประเภทรถที่ให้บริการ'),
})

export const BusinessDriverScema = Yup.object().shape({
  policyVersion: Yup.number(),
  driverType: Yup.string(),
  title: Yup.string().required('กรุณาเลือกคำนำหน้าบริษัท'),
  otherTitle: Yup.string().when('title', ([title], schema) =>
    isEqual(title, 'อื่นๆ') ? schema.required('กรุณาเลือกคำนำหน้าบริษัท') : schema.notRequired(),
  ),
  businessName: Yup.string().required('ระบุชื่อบริษัท').min(6, 'กรุณาระบุตัวอักษรขั้นต่ำ 6 ตัวอักษร'),
  businessBranch: Yup.string(),
  taxNumber: Yup.string()
    .matches(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
    .min(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
    .max(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก'),
  phoneNumber: Yup.string()
    .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
    .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .required('ระบุหมายเลขโทรศัพท์')
    .test('exiting-phonenumber', 'หมายเลขโทรศัพท์ถูกใช้งานแล้ว', async (value) => {
      const existingDriver = await DriverDetailModel.findOne({ phoneNumber: value })
      return !existingDriver
    }),
  lineId: Yup.string(), //.required('ระบุไลน์ไอดี'),
  address: Yup.string().required('ระบุที่อยู่'),
  province: Yup.string().required('ระบุจังหวัด'),
  district: Yup.string().required('ระบุอำเภอ/แขวง'),
  subDistrict: Yup.string().required('ระบุตำบล/เขต'),
  postcode: Yup.string().required('ระบุรหัสไปรษณีย์').min(5, 'รหัสไปรษณีย์ 5 หลัก').max(5, 'รหัสไปรษณีย์ 5 หลัก'),

  bank: Yup.string().required('ระบุธนาคารที่ชำระ'),
  bankBranch: Yup.string()
    .required('ระบุชื่อสาขาธนาคาร')
    .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
  bankName: Yup.string()
    .required('ระบุชื่อบัญชี')
    .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
  bankNumber: Yup.string()
    .required('ระบุเลขที่บัญชี')
    .matches(/^[0-9\s]+$/g, 'ตัวเลขเท่านั้น')
    .min(10, 'ตัวเลขขั้นต่ำ 10 หลัก')
    .max(15, 'ตัวเลขสูงสุด 15 หลัก'),
  serviceVehicleTypes: Yup.array().min(1, 'ระบุประเภทรถที่ให้บริการ'),
})

export const EmployeeDriverScema = Yup.object().shape({
  title: Yup.string().required('กรุณาเลือกคำนำหน้าชื่อ'),
  otherTitle: Yup.string().when('title', ([title], schema) =>
    isEqual(title, 'อื่นๆ') ? schema.required('ระบุคำนำหน้าชื่อ') : schema.notRequired(),
  ),
  firstname: Yup.string()
    .required('ระบุชื่อ')
    .matches(/^[ก-๙\s]+$/, 'ระบุเป็นภาษาไทยเท่านั้น'),
  lastname: Yup.string()
    .required('ระบุนามสกุล')
    .matches(/^[ก-๙\s]+$/, 'ระบุเป็นภาษาไทยเท่านั้น'),
  taxNumber: Yup.string()
    .matches(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
    .min(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
    .max(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก'),
  phoneNumber: Yup.string()
    .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
    .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
    .required('ระบุหมายเลขโทรศัพท์')
    .test('exiting-phonenumber', 'หมายเลขโทรศัพท์ถูกใช้งานแล้ว', async (value) => {
      const existingDriver = await DriverDetailModel.findOne({ phoneNumber: value })
      return !existingDriver
    }),
  lineId: Yup.string(), //.required('ระบุไลน์ไอดี'),
  address: Yup.string().required('ระบุที่อยู่'),
  province: Yup.string().required('ระบุจังหวัด'),
  district: Yup.string().required('ระบุอำเภอ/แขวง'),
  subDistrict: Yup.string().required('ระบุตำบล/เขต'),
  postcode: Yup.string().required('ระบุรหัสไปรษณีย์').min(5, 'รหัสไปรษณีย์ 5 หลัก').max(5, 'รหัสไปรษณีย์ 5 หลัก'),
})
