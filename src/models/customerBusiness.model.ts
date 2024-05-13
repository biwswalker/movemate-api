import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

@ObjectType()
export class BusinessCustomer {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  user_number: string;

  @Field()
  @Property({ enum: ["Co", "Part", "Pub", "other"], required: true })
  business_titles: string;

  @Field()
  @Property({ required: true })
  business_name: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  business_branch: string;

  @Field()
  @Property({ required: true })
  business_type: string;

  @Field()
  @Property()
  business_type_other: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(13)
  @Property({ required: true })
  tax_number: string;

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
  sub_district: string;

  @Field()
  @IsString()
  @Property({ required: true })
  postcode: string;

  @Field()
  @Property({ required: true })
  contact_number: string;

  @Field()
  @IsEmail()
  @Property({ required: true })
  business_email: string;

  @Field()
  @Property({ enum: ["cash", "credit"], required: true })
  payment_method: string;

  // E-Document
  @Field()
  @Property()
  accepted_edocument_date: string;

  // Policies
  @Field()
  @Property()
  accepted_policies_version: string;

  @Field()
  @Property()
  accepted_policies_date: string;

  // Term and Conditions
  @Field()
  @Property()
  accepted_term_condition_version: string;

  @Field()
  @Property()
  accepted_term_condition_date: string;
}

const BusinessCustomerModel = getModelForClass(BusinessCustomer);

export default BusinessCustomerModel;
