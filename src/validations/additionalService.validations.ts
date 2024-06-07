import Yup from "./yup"
import { isEmpty, isEqual } from "lodash"
import AdditionalServiceModel from "@models/additionalService.model"

const Descriptions = Yup.array(Yup.object().shape({
    detail: Yup.string().required('ระบุคำอธิบายบริการเสริมสำหรับประเภทรถ'),
    vehicleTypes: Yup.array(Yup.string().required('เลือกประเภทรถ')).min(1, 'เลือกประเภทรถอย่างน้อย 1 ประเภท')
}))

export const AdditionalServiceSchema = (isEdit: boolean = false) => Yup.object().shape({
    type: Yup.string().required('ระบุประเภทบริการเสริม').oneOf(['services', 'accessories'], 'ไม่มีประเภทบริการเสริมนี้'),
    name: Yup.string()
        .required('ระบุชื่อบริการเสริม')
        .test({
            name: 'existing-name',
            message: 'ไม่สามารถใช้ชื่อบริการเสริมซ้ำได้',
            test: async (value) => {
                const isExistingAdditionalService = await AdditionalServiceModel.findOne({ name: value })
                if (isExistingAdditionalService && isEdit) {
                    if (isEqual(value, isExistingAdditionalService.name)) {
                        return true
                    }
                }
                return isEmpty(isExistingAdditionalService)
            }
        }),
    status: Yup.string().required('สถานะ'),
    descriptions: Descriptions
})