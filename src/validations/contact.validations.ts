import Yup from "./yup";

export const ContactSchema = Yup.object().shape({
  fullname: Yup.string()
    .min(3, 'กรุณาระบุชื่อ - นามสกุล อย่างน้อย 3 ตัว')
    .required('กรุณาระบุชื่อ - นามสกุล ผู้ติดต่อ'),
  email: Yup.string().email('กรุณาระบุอีเมล').required('กรุณาระบุอีเมล'),
  title: Yup.string().required('กรุณาระบุชื่อเรื่องที่ต้องการติดต่อ'),
  detail: Yup.string().required('กรุณาระบุข้อความเนื้อหาที่ต้องการติดต่อ'),
  contactNumber: Yup.string().required('กรุณาระบุดเบอร์ติดต่อ'),
})
