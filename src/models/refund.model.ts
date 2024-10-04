import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { File } from './file.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'

export enum ERefundStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  CANCELLED = 'cancelled',
}
registerEnumType(ERefundStatus, {
  name: 'ERefundStatus',
  description: 'Refund status',
})


@plugin(mongooseAutoPopulate)
@ObjectType()
export class Refund extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true, required: false })
  imageEvidence: Ref<File, string>

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  paymentDate: Date

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  paymentTime: Date

  @Field()
  @Property({ default: ERefundStatus.PENDING })
  refundStatus: ERefundStatus

  @Field()
  @Property()
  refundAmout: number

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field()
  @Property({ default: "" })
  updatedBy: string
}

const RefundModel = getModelForClass(Refund)

export default RefundModel
