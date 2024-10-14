import { isValid } from 'date-fns'
import Yup from './yup'
import EventModel from '@models/event.model'
import { isEmpty } from 'lodash'

export const EventSchema = Yup.object().shape({
  id: Yup.string(),
  start: Yup.date().typeError('ระบุวันที่').required('ระบุวันเริ่มต้น'),
  end: Yup.date()
    .typeError('ระบุวันที่')
    .required('ระบุวันสิ้นสุด')
    .test('require-min', 'กรุณาระบุวันสิ้นสุดมากกว่าหรือเท่ากับวันเริ่มต้น', (value, context) => {
      if (context.parent.start && value) {
        if (!isValid(value)) {
          context.createError({ message: 'ระบุวันเริ่มต้นให้ถูกต้อง' })
          return false
        }
        if (isValid(value)) {
          const start = new Date(context.parent.start).setHours(0, 0, 0, 0)
          const end = new Date(value).setHours(0, 0, 0, 0)
          if (start <= end) {
            return true
          }
        }
      }
      return false
    }),
  title: Yup.string()
    .required('ชื่อวันหยุด')
    .test('dupplicated-title', 'กรุณาห้ามใช้ชื่อวันหยุดซ้ำ', async (value, context) => {
      const event = await EventModel.findOne({
        title: value,
        ...(context.parent.id ? { $nor: [{ _id: context.parent.id }] } : {}),
      })
      return isEmpty(event)
    }),
  afterSubmit: Yup.string(),
})
