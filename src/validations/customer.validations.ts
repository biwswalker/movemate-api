import UserModel from '@models/user.model'
import Yup from './yup'
import { isEmpty, isEqual } from 'lodash'
import IndividualCustomerModel from '@models/customerIndividual.model'
import BusinessCustomerModel from '@models/customerBusiness.model'
import { EPaymentMethod } from '@enums/payments'
import { EUserRole, EUserType } from '@enums/users'

export const IndividualCustomerSchema = (userId?: string) =>
  Yup.object().shape({
    userType: Yup.string(),
    remark: Yup.string(),
    status: Yup.string(),
    email: Yup.string()
      .email('ระบุในรูปแบบอีเมลเท่านั้น')
      .required('ระบุอีเมล')
      .test('exiting-email', 'อีเมลถูกใช้งานแล้ว', async (value) => {
        if (userId) {
          const individualResult = await UserModel.existingEmail(
            userId,
            value,
            EUserType.INDIVIDUAL,
            EUserRole.CUSTOMER,
          )
          const businessResult = await UserModel.existingEmail(userId, value, EUserType.BUSINESS, EUserRole.CUSTOMER)
          return !individualResult && !businessResult
        }
        const individualResult = await IndividualCustomerModel.findOne({ email: value })
        const businessResult = await BusinessCustomerModel.findOne({ businessEmail: value })
        return !individualResult && !businessResult
      }),
    title: Yup.string().required('กรุณาเลือกคำนำหน้าชื่อ'),
    otherTitle: Yup.string().when('title', ([title], schema) =>
      isEqual(title, 'อื่นๆ') ? schema.required('ระบุคำนำหน้าชื่อ') : schema.notRequired(),
    ),
    firstname: Yup.string().required('ระบุชื่อ'),
    lastname: Yup.string().required('ระบุนามสกุล'),
    phoneNumber: Yup.string()
      .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
      .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
      .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
      .required('ระบุหมายเลขโทรศัพท์')
      .test('exiting-phonnumber', 'หมายเลขติดต่อถูกใช้งานแล้ว', async (value) => {
        const result = await UserModel.existingPhonenumber(value, userId)
        return !result
      }),
    isVerifiedEmail: Yup.boolean(),
    isVerifiedPhoneNumber: Yup.boolean(),
    taxId: Yup.string()
      .transform((value) => (String(value).trim() === '' ? null : value))
      .nullable()
      .matches(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
      .length(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
      .test('exiting-taxId', 'เลขประจำตัวผู้เสียภาษีถูกใช้งานแล้ว', async (value) => {
        if(!value) return true
        const result = await UserModel.existingTaxId(value, userId)
        return !result
      }),
    address: Yup.string(),
    province: Yup.string(),
    district: Yup.string(),
    subDistrict: Yup.string(),
    postcode: Yup.string().minmaxNoRequire(5, 5, 'รหัสไปรษณีย์ 5 หลัก'),
    profileImage: Yup.mixed(),
  })

const creditMethodValidation: any =
  (message: string) =>
  ([paymentMethod]: [string], schema: Yup.StringSchema<string>) => {
    return isEqual(paymentMethod, EPaymentMethod.CREDIT) ? schema.required(message) : schema.notRequired()
  }

const CashPaymentSchema = Yup.object().shape({
  acceptedEReceiptDate: Yup.string(),
  acceptedEReceipt: Yup.boolean(),
})

const MonthBillingCycleSchema = Yup.object().shape({
  issueDate: Yup.number(),
  dueDate: Yup.number(),
  dueMonth: Yup.number(),
})

const YearlyBillingCycleSchema = Yup.object().shape({
  jan: MonthBillingCycleSchema,
  feb: MonthBillingCycleSchema,
  mar: MonthBillingCycleSchema,
  apr: MonthBillingCycleSchema,
  may: MonthBillingCycleSchema,
  jun: MonthBillingCycleSchema,
  jul: MonthBillingCycleSchema,
  aug: MonthBillingCycleSchema,
  sep: MonthBillingCycleSchema,
  oct: MonthBillingCycleSchema,
  nov: MonthBillingCycleSchema,
  dec: MonthBillingCycleSchema,
})

const CreditPaymentSchema = Yup.object().shape({
  acceptedFirstCreditTerm: Yup.boolean(),
  acceptedFirstCreditTermDate: Yup.string(),
  billingCycleType: Yup.string(),
  billingCycle: YearlyBillingCycleSchema,
  creditLimit: Yup.number(),
  creditUsage: Yup.number(),
  financialAddress: Yup.string().when('paymentMethod', creditMethodValidation('ระบุที่อยู่ ผู้ติดต่อด้านการเงิน')),
  financialContactEmails: Yup.array(Yup.string().email('ระบุในรูปแบบอีเมลเท่านั้น')),
  'financialContactEmails.0': Yup.string().when(
    ['paymentMethod', 'financialContactEmails[0]'],
    ([paymentMethod, financialEmail], schema) => {
      // TODO: payment
      return isEqual(paymentMethod, EPaymentMethod.CREDIT)
        ? schema.email('ระบุในรูปแบบอีเมลเท่านั้น').test('is-require', 'ระบุอีเมล', () => !isEmpty(financialEmail))
        : schema.notRequired()
    },
  ),
  financialContactNumber: Yup.string()
    .when('paymentMethod', creditMethodValidation('ระบุชื่อผู้ติดต่อด้านการเงิน'))
    .when('paymentMethod', ([paymentMethod], schema) => {
      return isEqual(paymentMethod, EPaymentMethod.CREDIT)
        ? schema
            .required('ระบุหมายเลขโทรศัพท์')
            .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
            .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
            .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
        : schema.notRequired()
    }),
  financialDistrict: Yup.string().when('paymentMethod', creditMethodValidation('ระบุอำเภอ/แขวง ผู้ติดต่อด้านการเงิน')),
  financialFirstname: Yup.string().when('paymentMethod', creditMethodValidation('ระบุชื่อ ผู้ติดต่อด้านการเงิน')),
  financialLastname: Yup.string().when('paymentMethod', creditMethodValidation('ระบุนามสกุล ผู้ติดต่อด้านการเงิน')),
  financialPostcode: Yup.string().when(
    'paymentMethod',
    creditMethodValidation('ระบุรหัสไปรษณีย์ ผู้ติดต่อด้านการเงิน'),
  ),
  financialProvince: Yup.string().when('paymentMethod', creditMethodValidation('ระบุจังหวัด ผู้ติดต่อด้านการเงิน')),
  financialSubDistrict: Yup.string().when('paymentMethod', creditMethodValidation('ระบุตำบล/เขต ผู้ติดต่อด้านการเงิน')),
  isSameAddress: Yup.boolean(),
  businessRegistrationCertificateFile: Yup.mixed(),
  copyIDAuthorizedSignatoryFile: Yup.mixed(),
  certificateValueAddedTaxRegistrationFile: Yup.mixed(),
})

export const BusinessCustomerSchema = (userId?: string) =>
  Yup.object().shape({
    userType: Yup.string(),
    remark: Yup.string(),
    isVerifiedEmail: Yup.boolean(),
    isVerifiedPhoneNumber: Yup.boolean(),
    status: Yup.string().required('ระบุสถานะ'),
    profileImage: Yup.mixed(),
    businessEmail: Yup.string()
      .email('ระบุในรูปแบบอีเมลเท่านั้น')
      .required('ระบุอีเมล')
      .test('exiting-email', 'อีเมลถูกใช้งานแล้ว', async (value) => {
        if (userId) {
          const individualResult = await UserModel.existingEmail(
            userId,
            value,
            EUserType.INDIVIDUAL,
            EUserRole.CUSTOMER,
          )
          const businessResult = await UserModel.existingEmail(userId, value, EUserType.BUSINESS, EUserRole.CUSTOMER)
          return !individualResult && !businessResult
        }
        const individualResult = await IndividualCustomerModel.findOne({ email: value })
        const businessResult = await BusinessCustomerModel.findOne({ businessEmail: value })
        return !individualResult && !businessResult
      }),
    businessTitle: Yup.string().required('กรุณาเลือกคำนำหน้าบริษัท/องค์กร'),
    businessName: Yup.string().required('ระบุชื่อบริษัท/องค์กร'),
    // Cancel this because we allow same business name for different users and different branches
    // .test('exiting-business-name', 'ชื่อบริษัท/องค์กรถูกใช้งานแล้ว', async (value) => {
    //   const result = await UserModel.existingBusinessName(value, userId)
    //   return !result
    // }),
    businessBranch: Yup.string(),
    businessType: Yup.string().required('กรุณาเลือกประเภทธุรกิจ'),
    businessTypeOther: Yup.string().when('businessType', ([businessType], schema) => {
      return isEqual(businessType, '-') ? schema.required('ระบุประเภทธุรกิจอื่น') : schema.notRequired()
    }),
    contactNumber: Yup.string()
      .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
      .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
      .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
      .required('ระบุเบอร์ผู้ติดต่อผู้สมัคร/ผู้ดูแล')
      .test('exiting-phonnumber', 'หมายเลขติดต่อถูกใช้งานแล้ว', async (value) => {
        const result = await UserModel.existingPhonenumber(value, userId)
        return !result
      }),
    paymentMethod: Yup.string().required('กรุณาเลือกวิธีการชำระเงิน'),
    taxNumber: Yup.string()
      .matches(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
      .required('เลขประจำตัวผู้เสียภาษี')
      .min(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
      .max(13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก')
      .test('exiting-taxId', 'เลขประจำตัวผู้เสียภาษีถูกใช้งานแล้ว', async (value) => {
        const result = await UserModel.existingTaxId(value, userId)
        return !result
      }),
    address: Yup.string().required('ระบุที่อยู่'),
    province: Yup.string().required('ระบุจังหวัด'),
    district: Yup.string().required('ระบุอำเภอ/แขวง'),
    subDistrict: Yup.string().required('ระบุตำบล/เขต'),
    postcode: Yup.string().required('ระบุรหัสไปรษณีย์').min(5, 'รหัสไปรษณีย์ 5 หลัก').max(5, 'รหัสไปรษณีย์ 5 หลัก'),

    cashPayment: CashPaymentSchema,
    creditPayment: CreditPaymentSchema,
  })

export const ChangePasswordSchema = Yup.object().shape({
  password: Yup.string()
    .matches(/^[a-zA-Z0-9_.-]*$/, 'รหัสผ่านสามารถระบุตัวเลขและตัวอักษร ห้ามมีสัญลักษณ์')
    .min(8, 'รหัสผ่านจำเป็นต้องมี 8 ตัวขึ้นไป')
    .required('รหัสผ่านสามารถระบุตัวเลขและตัวอักษร ห้ามมีสัญลักษณ์'),
  confirmPassword: Yup.string()
    .matches(/^[a-zA-Z0-9_.-]*$/, 'รหัสผ่านสามารถระบุตัวเลขและตัวอักษร ห้ามมีสัญลักษณ์')
    .min(8, 'รหัสผ่านจำเป็นต้องมี 8 ตัวขึ้นไป')
    .required('รหัสผ่านยืนยันสามารถระบุตัวเลขและตัวอักษร ห้ามมีสัญลักษณ์')
    .oneOf([Yup.ref('password')], 'รหัสผ่านไม่ตรงกัน'),
})
