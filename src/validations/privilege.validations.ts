import PrivilegeModel from '@models/privilege.model'
import Yup from './yup'
import { isEmpty } from 'lodash'

export const PrivilegeSchema = (_id?: string) =>
  Yup.object().shape({
    status: Yup.string().required('ระบุสถานะ').oneOf(['active', 'inactive'], 'ไม่มีระบุสถานะนี้'),
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
    maxDiscountPrice: Yup.number(),
    isInfinity: Yup.boolean(),
    limitAmout: Yup.number(),
    description: Yup.string(),
    afterSubmit: Yup.string(),
  })
