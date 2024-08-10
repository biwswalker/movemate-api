import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { Field, ID, Int, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, Ref, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from "mongoose-autopopulate"
import { Schema } from "mongoose"
import { File } from "./file.model"

export enum EStepStatus {
  IDLE = 'idle',
  PROGRESSING = 'progressing',
  DONE = 'done',
  EXPIRE = 'expire',
  CANCELLED = 'cancelled',
}

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
}

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
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class StepDefinition extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  step: TStepDefinition

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

  @Field()
  @Property({ default: EStepStatus.IDLE, enum: EStepStatus })
  stepStatus: TStepStatus

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
