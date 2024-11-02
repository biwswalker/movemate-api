import { ObjectType, Field, ID, Int, Float, InputType } from "type-graphql";
import {
  prop as Property,
  Ref,
  Severity,
  getModelForClass,
  plugin,
} from "@typegoose/typegoose";
import { File } from "./file.model";
import autopopulate from 'mongoose-autopopulate'
import { IsEnum, IsNotEmpty } from "class-validator";

export enum EBilledType {
  DEFAULT = 'default',
  DATES = 'dates'
}

@ObjectType()
export class BilledMonth {
  @Field(() => Int)
  @Property()
  jan: number;

  @Field(() => Int)
  @Property()
  feb: number;

  @Field(() => Int)
  @Property()
  mar: number;

  @Field(() => Int)
  @Property()
  apr: number;

  @Field(() => Int)
  @Property()
  may: number;

  @Field(() => Int)
  @Property()
  jun: number;

  @Field(() => Int)
  @Property()
  jul: number;

  @Field(() => Int)
  @Property()
  aug: number;

  @Field(() => Int)
  @Property()
  sep: number;

  @Field(() => Int)
  @Property()
  oct: number;

  @Field(() => Int)
  @Property()
  nov: number;

  @Field(() => Int)
  @Property()
  dec: number;
}

@plugin(autopopulate)
@ObjectType()
export class BusinessCustomerCreditPayment {
  @Field(() => ID)
  readonly _id: string;

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

  @Field()
  @IsEnum(EBilledType)
  @IsNotEmpty()
  @Property({ enum: EBilledType, default: EBilledType.DEFAULT, required: true })
  billedDateType: TBilledMonthType;

  @Field(type => BilledMonth)
  @Property({ required: true })
  billedDate: BilledMonth;

  @Field()
  @IsEnum(EBilledType)
  @IsNotEmpty()
  @Property({ enum: EBilledType, default: EBilledType.DEFAULT, required: true })
  billedRoundType: TBilledMonthType;

  @Field(type => BilledMonth)
  @Property({ required: true })
  billedRound: BilledMonth;

  @Field({ nullable: true })
  @Property()
  acceptedFirstCreditTermDate: Date;

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  businessRegistrationCertificateFile: Ref<File>;

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  copyIDAuthorizedSignatoryFile: Ref<File>;

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  certificateValueAddedTaxRegistrationFile: Ref<File>

  // Credit
  @Field(() => Float)
  @Property({ required: true })
  creditLimit: number;

  @Field(() => Float)
  @Property({ required: true })
  creditUsage: number;

  @Field(() => Float, { defaultValue: 0 })
  @Property({ required: true, default: 0 })
  creditOutstandingBalance: number;
}

const BusinessCustomerCreditPaymentModel = getModelForClass(
  BusinessCustomerCreditPayment
);

export default BusinessCustomerCreditPaymentModel;
