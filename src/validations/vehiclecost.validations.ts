import Yup from "./yup";

const AdditionalServiceSchema = Yup.array(
  Yup.object().shape({
    type: Yup.string(),
    additionalService: Yup.mixed(),
    available: Yup.boolean(),
    cost: Yup.number()
      .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
      .required("ระบุราคาต้นทุน"),
    price: Yup.number()
      .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
      .required("ระบุราคาต้นทุน"),
  })
).min(1, "กรุณาระบุราคาบริการเสริม");

export const AdditionalServiceCostSchema = Yup.object()
  .shape({
    additionalServices: AdditionalServiceSchema,
  })
  .required("กรุณาระบุราคาบริการเสริม");

const DistanceSchema = Yup.object().shape({
  from: Yup.number()
    .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
    .required("ระบุรัศมีเริ่มต้น"),
  to: Yup.number()
    .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
    .required("ระบุรัศมีสิ้นสุด")
    .test(
      "minimum-value",
      "รัศมีสิ้นสุดจะต้องมากกว่าหรือเท่ากับรัศมีเริ่มต้นเท่านั้น",
      (value, context) => {
        if (typeof context.parent.from === "number") {
          return value >= context.parent.from;
        }
        return true;
      }
    ),
  unit: Yup.string().required("ระบุหน่วย"),
  cost: Yup.number()
    .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
    .required("ระบุราคาต้นทุน"),
  price: Yup.number()
    .typeError("กรุณากรอกเป็นตัวเลขเท่านั้น")
    .required("ระบุราคาขาย"),
});

export const DistanceCostPricingSchema = Yup.object()
  .shape({
    distanceCostPricings: Yup.array(DistanceSchema).min(
      1,
      "กรุณาระบุราคาตามระยะทาง"
    ),
  })
  .required("กรุณาระบุราคาตามระยะทาง");
