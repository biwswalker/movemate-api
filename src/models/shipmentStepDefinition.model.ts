import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { Field, ID, Int, ObjectType, registerEnumType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { Schema } from 'mongoose'
import { File } from './file.model'

export enum EStepStatus {
  IDLE = 'IDLE',
  PROGRESSING = 'PROGRESSING',
  DONE = 'DONE',
  EXPIRE = 'EXPIRE',
  CANCELLED = 'CANCELLED',
}
registerEnumType(EStepStatus, {
  name: 'EStepStatus',
  description: 'Step status',
})

export enum EStepDefinition {
  CREATED = 'CREATED',
  CASH_VERIFY = 'CASH_VERIFY',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED',
  CONFIRM_DATETIME = 'CONFIRM_DATETIME',
  ARRIVAL_PICKUP_LOCATION = 'ARRIVAL_PICKUP_LOCATION',
  PICKUP = 'PICKUP',
  ARRIVAL_DROPOFF = 'ARRIVAL_DROPOFF',
  DROPOFF = 'DROPOFF',
  POD = 'POD',
  FINISH = 'FINISH',
  REJECTED_PAYMENT = 'REJECTED_PAYMENT',
  UNINTERESTED_DRIVER = 'UNINTERESTED_DRIVER',
  REFUND = 'REFUND',
  OTHER = 'OTHER',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  SYSTEM_CANCELLED = 'SYSTEM_CANCELLED',
}
registerEnumType(EStepDefinition, {
  name: 'EStepDefinition',
  description: 'Step definition',
})

export enum EStepDefinitionName {
  CREATED = 'งานเข้าระบบ',
  CASH_VERIFY = 'ยืนยันการชำระเงิน',
  DRIVER_ACCEPTED = 'รอคนขับตอบรับ',
  CONFIRM_DATETIME = 'นัดหมายและยืนยันเวลา',
  ARRIVAL_PICKUP_LOCATION = 'ถึงจุดรับสินค้า',
  PICKUP = 'ขึ้นสินค้าที่จุดรับสินค้า',
  ARRIVAL_DROPOFF = 'ถึงจุดส่งสินค้า',
  DROPOFF = 'จัดส่งสินค้า',
  FINISH = 'จัดส่งสำเร็จ',
  POD = 'แนบเอกสารและส่งเอกสาร POD',
  REJECTED_PAYMENT = 'ไม่อนุมัติการชำระเงิน',
  UNINTERESTED_DRIVER = 'ไม่มีคนขับตอบรับงานนี้',
  REFUND = 'ดำเนินการคืนเงิน',
  OTHER = 'อื่นๆ',
  CUSTOMER_CANCELLED = 'ลูกค้ายกเลิกงานขนส่ง',
  SYSTEM_CANCELLED = 'ระบบยกเลิกงานขนส่ง',
}
registerEnumType(EStepDefinitionName, {
  name: 'EStepDefinitionName',
  description: 'Step definition name',
})

@plugin(mongooseAutoPopulate)
@ObjectType()
export class StepDefinition extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => EStepDefinition)
  @Property()
  step: EStepDefinition

  @Field(() => Int)
  @Property()
  seq: number

  @Field()
  @Property({ enum: EStepDefinitionName })
  stepName: EStepDefinitionName

  @Field()
  @Property()
  customerMessage: string

  @Field()
  @Property()
  driverMessage: string

  @Field(() => Int, { nullable: true })
  @Property({ default: 0, required: false })
  meta: number

  @Field(() => EStepStatus)
  @Property({ default: EStepStatus.IDLE, enum: EStepStatus })
  stepStatus: EStepStatus

  @Field(() => [File])
  @Property({
    ref: () => File,
    type: Schema.Types.ObjectId,
    autopopulate: true,
    default: [],
  })
  images?: Ref<File, string>[]

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field({ nullable: true })
  @Property()
  updatedAt?: Date
}

const StepDefinitionModel = getModelForClass(StepDefinition)

export default StepDefinitionModel
