import VehicleTypeModel from "@models/vehicleType.model"
import Yup from "./yup"
import { isEmpty, isEqual } from "lodash"

export const VehicleTypeSchema = (isEdit: boolean = false) => Yup.object().shape({
    type: Yup.string().required('ระบุประเภทขนาดรถ').oneOf(['4W', '6W', '10W', 'other'], 'ไม่มีประเภทของขนาดรถนี้'),
    isPublic: Yup.boolean(),
    isLarger: Yup.boolean(),
    name: Yup.string()
        .required('ระบุประเภทรถ')
        .test({
            name: 'existing-name',
            message: 'ไม่สามารถใช้ประเภทรถซ้ำได้',
            test: async (value) => {
                const isExistingVehicleType = await VehicleTypeModel.findOne({ name: value })
                if (isExistingVehicleType && isEdit) {
                    if (isEqual(value, isExistingVehicleType.name)) {
                        return true
                    }
                }
                return isEmpty(isExistingVehicleType)
            }
        }),
    width: Yup.number().required('ระบุขนาดความกว้างรถ (เซนติเมตร)'),
    length: Yup.number().required('ระบุขนาดความยาวรถ (เซนติเมตร)'),
    height: Yup.number().required('ระบุขนาดความสูงรถ (เซนติเมตร)'),
    maxCapacity: Yup.number().required('ระบุน้ำหนักบรรทุกสูงสุด (กิโลกรัม)'),
    maxDroppoint: Yup.number().required('ระบุจำนวนจุดส่งสูงสุด'),
    ...(isEdit
        ? { image: Yup.mixed() }
        : { image: Yup.mixed().required('ระบุรูปประเภทรถ') }),
    details: Yup.string(), //.required('ระบุรายละเอียด'),
    afterSubmit: Yup.string(),
})