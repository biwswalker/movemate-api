import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { PaymentAmounts, Price, QuotationDetail } from './objects'
import { User } from '@models/user.model'
import { EQuotationStatus } from '@enums/shipments'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class Quotation extends PaymentAmounts {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  quotationNumber: string

  @Field()
  @Property({ required: true })
  quotationDate: Date

  @Field(() => Price)
  @Property({ required: true })
  price: Price

  @Field(() => Price)
  @Property({ required: true })
  cost: Price

  @Field(() => QuotationDetail)
  @Property()
  detail: QuotationDetail

  @Field(() => EQuotationStatus, { defaultValue: EQuotationStatus.ACTIVE })
  @Property({ default: EQuotationStatus.ACTIVE })
  status: EQuotationStatus

  @Field(() => String, { nullable: true })
  @Property()
  remark: string

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, required: false, autopopulate: true })
  updatedBy: Ref<User>
}

const QuotationModel = getModelForClass(Quotation)

export default QuotationModel
