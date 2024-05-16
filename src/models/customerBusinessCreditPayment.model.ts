import { ObjectType, Field, ID, Int, Float } from "type-graphql";
import {
  prop as Property,
  Ref,
  Severity,
  getModelForClass,
} from "@typegoose/typegoose";
import { IsNotEmpty, IsString } from "class-validator";
import { File } from "./file.model";

@ObjectType()
export class BusinessCustomerCreditPayment {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  userNumber: string;

  // Credit
  @Field({ nullable: true })
  @Property({ default: false })
  isSameAddress: boolean;

  @Field()
  @Property({ required: true })
  financialFirstname: string;

  @Field()
  @Property({ required: true })
  financialLastname: string;

  @Field()
  @Property({ required: true })
  financialContactNumber: string;

  @Field(() => [String])
  @Property({ required: true, allowMixed: Severity.ALLOW })
  financialContactEmails: string[];

  @Field()
  @Property({ required: true })
  financialAddress: string;

  @Field()
  @Property({ required: true })
  financialPostcode: string;

  @Field()
  @Property({ required: true })
  financialProvince: string;

  @Field()
  @Property({ required: true })
  financialDistrict: string;

  @Field()
  @Property({ required: true })
  financialSubDistrict: string;

  @Field(type => Int)
  @Property({ required: true })
  billedDate: number;

  @Field(type => Int)
  @Property({ required: true })
  billedRound: number;

  @Field({ nullable: true })
  @Property()
  acceptedFirstCredit_termDate: Date;

  @Field(() => File)
  @Property({ ref: () => File })
  businessRegistrationCertificateFile: Ref<File>;

  @Field(() => File)
  @Property({ ref: () => File })
  copyIDAuthorizedSignatoryFile: Ref<File>;

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File })
  certificateValueAddedTaxRefistrationFile: Ref<File>

  // Credit
  @Field(() => Float)
  @Property({ required: true })
  creditLimit: number;

  @Field(() => Float)
  @Property({ required: true })
  creditUsage: number;
}

const BusinessCustomerCreditPaymentModel = getModelForClass(
  BusinessCustomerCreditPayment
);

export default BusinessCustomerCreditPaymentModel;
