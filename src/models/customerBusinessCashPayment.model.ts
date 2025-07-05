import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class BusinessCustomerCashPayment {
  @Field(() => ID)
  readonly _id: string

  @Field({ nullable: true })
  @Property()
  acceptedEReceiptDate: Date
}

const BusinessCustomerCashPaymentModel = getModelForClass(BusinessCustomerCashPayment)

export default BusinessCustomerCashPaymentModel
