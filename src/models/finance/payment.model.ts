import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from 'class-validator'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { User } from '@models/user.model'
import { PaymentAmounts } from './objects'
import { Quotation } from './quotation.model'
import { PaymentEvidence } from './evidence.model'

/**
 * TODO:
 * - Create logs for update
 */
@plugin(mongooseAutoPopulate)
@ObjectType()
export class Payment extends PaymentAmounts {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  paymentNumber: string

  @Field(() => EPaymentStatus)
  @IsEnum(EPaymentStatus)
  @Property({ enum: EPaymentStatus, default: EPaymentStatus.PENDING })
  status: EPaymentStatus

  @Field(() => EPaymentType)
  @IsEnum(EPaymentType)
  @Property({ enum: EPaymentType, default: EPaymentType.PAY })
  type: EPaymentType

  @Field(() => EPaymentMethod)
  @Property({ enum: EPaymentMethod, default: EPaymentMethod.CASH })
  paymentMethod: EPaymentMethod

  @Field(() => [PaymentEvidence], { nullable: true })
  @Property({ required: false, ref: () => PaymentEvidence, autopopulate: true })
  evidence: Ref<PaymentEvidence>[]

  @Field(() => [Quotation], { defaultValue: [] })
  @Property({ ref: () => Quotation, autopopulate: true, default: [] })
  quotations: Ref<Quotation>[]

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false })
  updatedBy: Ref<User>
}

const PaymentModel = getModelForClass(Payment)

export default PaymentModel
