import PrivilegeModel from '@models/privilege.model'
import Yup from './yup'
import { isEmpty } from 'lodash'
import { EPrivilegeStatus } from '@enums/privilege'

export const PrivilegeSchema = (_id?: string) =>
  Yup.object().shape({
    status: Yup.string().required('ระบุสถานะ').oneOf([EPrivilegeStatus.ACTIVE, EPrivilegeStatus.INACTIVE], 'ระบุสถานะ'),
    name: Yup.string()
      .required('ระบุชื่อโปรโมชั่น/ส่วนลด*')
      .matches(/^[a-zA-Z0-9ก-๙\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษและภาษาอังกฤษตัวใหญ่เท่านั้น')
      .test({
        name: 'existing-name',
        message: 'ไม่สามารถใช้ชื่อโปรโมชั่น/ส่วนลดซ้ำได้',
        test: async (value) => {
          const isExistingPrivilege = await PrivilegeModel.findOne({
            name: value,
            ...(_id ? { _id: { $ne: _id } } : {}),
          })
          return isEmpty(isExistingPrivilege)
        },
      }),
    code: Yup.string()
      .required('ระบุโค้ทส่วนลด')
      .matches(/^[A-Z0-9\s]+$/g, 'ไม่อนุญาตมีอักษรพิเศษและภาษาอังกฤษตัวใหญ่เท่านั้น')
      .test({
        name: 'existing-name',
        message: 'ไม่สามารถใช้โค้ทส่วนลดซ้ำได้',
        test: async (value) => {
          const isExistingPrivilege = await PrivilegeModel.findOne({
            code: value,
            ...(_id ? { _id: { $ne: _id } } : {}),
          })
          return isEmpty(isExistingPrivilege)
        },
      }),
    startDate: Yup.string(),
    endDate: Yup.string(),
    discount: Yup.number().required('ระบุส่วนลด'),
    unit: Yup.string().required('ระบุหน่วยของส่วนลด'),
    minPrice: Yup.number(),
    // .nullable()
    // .transform((value) => (value === '' ? null : value))
    // .when(['unit', 'discount'], ([unit, discount], schema) => {
    //   return unit === EPrivilegeDiscountUnit.CURRENCY
    //     ? schema.when('$self', {
    //         is: (value: any) => value !== null,
    //         then: (schema) => schema.min(discount, 'กรุณาระบุค่าส่วนลดให้ถูกต้อง'),
    //       })
    //     : schema
    // }),
    maxDiscountPrice: Yup.number(),
    limitAmout: Yup.number(),
    limitPerUser: Yup.number(),
    description: Yup.string(),
    defaultShow: Yup.boolean(),
  })
