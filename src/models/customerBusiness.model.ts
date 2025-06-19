import { ObjectType, Field, ID, Int } from "type-graphql";
import { prop as Property, Ref, getModelForClass, plugin } from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";
import autopopulate from 'mongoose-autopopulate'
import { BusinessCustomerCreditPayment } from "./customerBusinessCreditPayment.model";
import { BusinessCustomerCashPayment } from "./customerBusinessCashPayment.model";
import { EPaymentMethod } from "@enums/payments";

@plugin(autopopulate)
@ObjectType()
export class BusinessCustomer {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true, sparse: true })
  userNumber: string;

  @Field()
  @Property({ enum: ["Co", "Part", "Pub", "other"], required: true })
  businessTitle: string;

  @Field()
  @Property({ required: true })
  businessName: string;

  @Field({ nullable: true })
  @Property()
  businessBranch?: string;

  @Field()
  @Property({ required: true })
  businessType: string;

  @Field({ nullable: true })
  @Property()
  businessTypeOther: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(13)
  @Property({ required: true })
  taxNumber: string;

  @Field()
  @IsString()
  @Property({ required: true })
  address: string;

  @Field()
  @Property({ required: true })
  province: string;

  @Field()
  @IsString()
  @Property({ required: true })
  district: string;

  @Field()
  @IsString()
  @Property({ required: true })
  subDistrict: string;

  @Field()
  @IsString()
  @Property({ required: true })
  postcode: string;

  @Field()
  @Property({ required: true })
  contactNumber: string;

  @Field()
  @IsEmail()
  @Property({ required: true })
  businessEmail: string;

  @Field(() => EPaymentMethod)
  @Property({ required: true })
  paymentMethod: EPaymentMethod;

  // E-Document
  @Field({ nullable: true })
  @Property()
  acceptedEDocumentDate: Date;

  // Policies
  @Field(type => Int, { nullable: true })
  @Property()
  acceptedPoliciesVersion: number;

  @Field({ nullable: true })
  @Property()
  acceptedPoliciesDate: Date;

  // Term and Conditions
  @Field(type => Int, { nullable: true })
  @Property()
  acceptedTermConditionVersion: number;

  @Field({ nullable: true })
  @Property()
  acceptedTermConditionDate: Date;

  @Field(() => BusinessCustomerCreditPayment, { nullable: true })
  @Property({ autopopulate: true, ref: 'BusinessCustomerCreditPayment' })
  creditPayment?: Ref<BusinessCustomerCreditPayment>

  @Field(() => BusinessCustomerCashPayment, { nullable: true })
  @Property({ autopopulate: true, ref: 'BusinessCustomerCashPayment' })
  cashPayment?: Ref<BusinessCustomerCashPayment>

  @Field({ nullable: true })
  @Property({ default: false })
  changePaymentMethodRequest?: boolean;

  static async findByUserNumber(userNumber: string): Promise<BusinessCustomer | null> {
    return BusinessCustomerModel.findOne({ userNumber });
  }
}

const BusinessCustomerModel = getModelForClass(BusinessCustomer);

export default BusinessCustomerModel;
