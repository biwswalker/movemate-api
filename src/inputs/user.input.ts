import { ArgsType, Field, InputType, Int } from "type-graphql";
import { RegisterBusinessInput, RegisterIndividualInput } from "./customer.input";
import { IsEmail } from "class-validator";

@InputType()
export class RegisterInput {
  @Field()
  userType: TUserType;

  @Field()
  password: string;

  @Field({ nullable: true })
  remark: string;

  @Field(type => Int)
  acceptPolicyVersion: number;

  @Field()
  acceptPolicyTime: Date;

  @Field(() => RegisterIndividualInput, { nullable: true })
  individualDetail: RegisterIndividualInput;

  @Field(() => RegisterBusinessInput, { nullable: true })
  businessDetail: RegisterBusinessInput;
}

@InputType()
export class UpdateBusinessDetailInput {
  @Field()
  userNumber: string;

  @Field()
  transportSupervisorPhoneNumber: string;

  @Field()
  transportSupervisorEmail: string;

  @Field()
  accountingPhoneNumber: string;

  @Field()
  accountingEmail: string;

  @Field()
  accountingAddress: string;

  @Field({ nullable: true })
  accountingCountry: string;

  @Field()
  accountingProvince: string;

  @Field()
  accountingDistrict: string;

  @Field()
  accountingSubDiatrict: string;

  @Field()
  accountingPostcode: string;

  @Field()
  creditTerm: boolean;

  @Field({ nullable: true })
  creditLimit: string;

  @Field({ nullable: true })
  creditAmount: string;

  @Field({ nullable: true })
  billedType: string;

  @Field({ nullable: true })
  dateOfBilled: string;

  @Field({ nullable: true })
  paymentDuedateType: string;

  @Field({ nullable: true })
  dateOfPaymentDuedate: string;

  @Field()
  isAcceptEDocuments: boolean;
}

@ArgsType()
export class GetCustomersArgs {
  @Field({ nullable: true })
  _id?: string;

  @Field({ nullable: true })
  userNumber: string;

  @Field({ nullable: true })
  userRole: TUserRole;

  @Field({ nullable: true })
  userType: TUserType;

  @Field({ nullable: true })
  username: string;

  @Field({ nullable: true })
  status: TUserStatus;

  @Field({ nullable: true })
  validationStatus: TUserValidationStatus;

  @Field({ nullable: true })
  registration: TRegistration;

  @Field({ nullable: true })
  lastestOTP: string;

  @Field({ nullable: true })
  lastestOTPRef: string;

  @Field({ nullable: true })
  isVerifiedEmail: boolean;

  @Field({ nullable: true })
  isVerifiedPhoneNumber: boolean;

  // Other
  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  phoneNumber: string

  @Field({ nullable: true })
  taxId: string
}