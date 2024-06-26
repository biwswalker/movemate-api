import UserModel from "@models/user.model";
import Yup from "./yup";

export const UserSchema = (userId: string) => Yup.object().shape({
    email: Yup.string().email('ระบุในรูปแบบอีเมลเท่านั้น').required('ระบุอีเมล').test('exiting-email', 'อีเมลซ้ำ', async (value) => {
        const individualResult = await UserModel.existingEmail(userId, value, 'individual')
        const businessResult = await UserModel.existingEmail(userId, value, 'business')
        return !individualResult && !businessResult
    }),
    title: Yup.string().required('กรุณาเลือกคำนำหน้าชื่อ'),
    firstname: Yup.string().required('ระบุชื่อ'),
    lastname: Yup.string().required('ระบุนามสกุล'),
    phoneNumber: Yup.string()
        .matches(/^(0[689]{1})+([0-9]{8})+$/, 'เบอร์ติดต่อไม่ถูกต้อง')
        .min(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
        .max(10, 'ระบุหมายเลขโทรศัพท์ไม่เกิน 10 หลัก')
        .required('ระบุหมายเลขโทรศัพท์'),
    isVerifiedEmail: Yup.boolean(),
    isVerifiedPhoneNumber: Yup.boolean(),
    taxId: Yup.string().minmaxNoRequire(13, 13, 'เลขประจำตัวผู้เสียภาษี 13 หลัก').matchNoRequire(/^[0-9]+$/, 'เลขประจำตัวผู้เสียภาษีเป็นตัวเลขเท่านั้น'),
    address: Yup.string(),
    province: Yup.string(),
    district: Yup.string(),
    subDistrict: Yup.string(),
    postcode: Yup.string().notRequired(),
    // .min(5, 'รหัสไปรษณีย์ 5 หลัก')
    // .max(5, 'รหัสไปรษณีย์ 5 หลัก'),
    profileImage: Yup.mixed(),
    afterSubmit: Yup.string(),
})