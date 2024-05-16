import { ObjectType, Field, ID, Int } from "type-graphql";
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

  @Field()
  @Property({ enum: ["cash", "credit"], required: true })
  paymentMethod: string;

  // E-Document
  @Field()
  @Property()
  acceptedEDocumentDate: Date;

  // Policies
  @Field(type => Int)
  @Property()
  acceptedPoliciesVersion: number;

  @Field()
  @Property()
  acceptedPoliciesDate: Date;

  // Term and Conditions
  @Field(type => Int)
  @Property()
  acceptedTermConditionVersion: number;

  @Field()
  @Property()
  acceptedTermConditionDate: Date;

  static async findByUserNumber(userNumber: string): Promise<BusinessCustomer | null> {
    return BusinessCustomerModel.findOne({ userNumber });
  }
}

const BusinessCustomerModel = getModelForClass(BusinessCustomer);

export default BusinessCustomerModel;
