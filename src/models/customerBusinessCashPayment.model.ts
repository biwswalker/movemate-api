import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsNotEmpty, IsString } from "class-validator";

@ObjectType()
export class BusinessCustomerCashPayment {
  @Field(() => ID)
  readonly _id: string;

  // Cash
  @Field()
  @Property()
  acceptedEReceiptDate: Date;
}

const BusinessCustomerCashPaymentModel = getModelForClass(
  BusinessCustomerCashPayment
);

export default BusinessCustomerCashPaymentModel;
