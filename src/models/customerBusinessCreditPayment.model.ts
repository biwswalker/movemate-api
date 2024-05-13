import { ObjectType, Field, ID } from "type-graphql";
import {
  prop as Property,
  Severity,
  getModelForClass,
} from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

@ObjectType()
export class BusinessCustomerCreditPayment {
  @Field(() => ID)
  readonly _id: string;

  @Field({ nullable: true })
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  user_number: string;

  // Credit
  @Field({ nullable: true })
  @Property()
  is_same_address: boolean;

  @Field({ nullable: true })
  @Property()
  financial_firstname: string;

  @Field({ nullable: true })
  @Property()
  financial_lastname: string;

  @Field({ nullable: true })
  @Property()
  financial_contact_number: string;

  @Field(() => [String])
  @Property({ required: true, allowMixed: Severity.ALLOW })
  financial_contact_emails: string[];

  @Field({ nullable: true })
  @Property()
  financial_address: string;

  @Field({ nullable: true })
  @Property()
  financial_postcode: string;

  @Field({ nullable: true })
  @Property()
  financial_province: string;

  @Field({ nullable: true })
  @Property()
  financial_district: string;
  
  @Field({ nullable: true })
  @Property()
  financial_sub_district: string;
  
  @Field({ nullable: true })
  @Property()
  billed_date: number;
  
  @Field({ nullable: true })
  @Property()
  billed_round: number;
  
  @Field({ nullable: true })
  @Property()
  accepted_first_credit_term_date: Date;
  
  // Files Path
  @Field({ nullable: true })
  @Property()
  business_registration_certificate_file_id: string;
  
  // Files Path
  @Field({ nullable: true })
  @Property()
  copy_ID_authorized_signatory_file_id: string;
  
  // Files
  @Field({ nullable: true })
  @Property()
  certificate_value_added_tax_refistration_file_id: string;

  // Credit
  @Field({ nullable: true })
  @Property()
  credit_limit: string;

  @Field({ nullable: true })
  @Property()
  credit_usage: string;
}

const BusinessCustomerCreditPaymentModel = getModelForClass(
  BusinessCustomerCreditPayment
);

export default BusinessCustomerCreditPaymentModel;
