import Yup from "./yup"

const AdditionalServiceSchema = Yup.array(
    Yup.object().shape({
        type: Yup.string(),
        additionalService: Yup.mixed(),
        available: Yup.boolean(),
        cost: Yup.number()
            .typeError('กรุณากรอกเป็นตัวเลขเท่านั้น')
            .required('ระบุราคาต้นทุน'),
        price: Yup.number()
            .typeError('กรุณากรอกเป็นตัวเลขเท่านั้น')
            .required('ระบุราคาต้นทุน'),
    }),
).min(1, 'กรุณาระบุราคาบริการเสริม')

export const AdditionalServiceCostSchema = Yup.object()
    .shape({
        additionalServices: AdditionalServiceSchema,
    })
    .required('กรุณาระบุราคาบริการเสริม')