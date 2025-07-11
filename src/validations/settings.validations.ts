import Yup from "./yup";

export const GeneralSchema = Yup.object().shape({
    instructiontext: Yup.string(),
    address: Yup.string(),
    taxId: Yup.string()
        .matchNoRequire(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น')
        .minmaxNoRequire(13, 13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก'),
    email: Yup.string().email('ระบุในรูปแบบอีเมลเท่านั้น'),
    phoneNumber: Yup.string()
        .matchNoRequire(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
        .minmaxNoRequire(9, 10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก'),
    facebook: Yup.string(),
    facebookLink: Yup.string().url('ระบุในรูปแบบ URL เท่านั้น เช่น "https://www.facebook.com"'),
    lineId: Yup.string(),
    lineLink: Yup.string().url('ระบุในรูปแบบ URL เท่านั้น เช่น "https://account.line.biz"'),
})

const TypeSchema = Yup.object().shape({
    name: Yup.string().required('ระบุประเภทธุรกิจ'),
})

export const BusinessTypesSchema = Yup.object().shape({
    businessTypes: Yup.array(TypeSchema),
})

const QuestionSchema = Yup.object().shape({
    question: Yup.string().required('ระบุคำถาม'),
    answer: Yup.string().required('ระบุคำตอบ'),
})

export const FAQsSchema = Yup.object().shape({
    faqs: Yup.array(QuestionSchema),
})

const InstructionValueSchema = Yup.object().shape({
    instruction: Yup.string(),
    instructionTitle: Yup.string(),
})

const InstructionsValueSchema = Yup.object().shape({
    page: Yup.string(),
    pageTitle: Yup.string(),
    instructions: Yup.array(InstructionValueSchema),
})

export const InstructionsSchema = Yup.object().shape({
    instructions: Yup.array(InstructionsValueSchema),
})

export const FinancialSchema = Yup.object().shape({
    bank: Yup.string().required('ระบุธนาคารที่ชำระ'),
    bankBranch: Yup.string()
      .required('ระบุชื่อสาขาธนาคาร')
      .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
    bankName: Yup.string().required('ระบุชื่อบัญชี'),
    // .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษ'),
    bankNumber: Yup.string()
      .required('ระบุเลขที่บัญชี')
      .matches(/^[0-9\s]+$/g, 'ตัวเลขเท่านั้น')
      .min(10, 'ตัวเลขขั้นต่ำ 10 หลัก')
      .max(15, 'ตัวเลขสูงสุด 15 หลัก'),
    descriptions: Yup.string(),
  })