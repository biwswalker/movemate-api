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
  acceptPolicyTime: string;

  @Field(() => RegisterIndividualInput, { nullable: true })
  individualDetail: RegisterIndividualInput;

  @Field(() => RegisterBusinessInput, { nullable: true })
  businessDetail: RegisterBusinessInput;
}


@InputType()
export class CutomerIndividualInput {
  @Field()
  userType: TUserType;

  @Field()
  status: TUserStatus;

  @Field({ nullable: true })
  remark: string;

  @Field({ nullable: true })
  isVerifiedEmail: boolean;

  @Field({ nullable: true })
  isVerifiedPhoneNumber: boolean;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  title: string;

  @Field()
  firstname: string;

  @Field()
  lastname: string;

  @Field()
  phoneNumber: string;

  @Field({ nullable: true })
  taxId: string;

  @Field({ nullable: true })
  address: string;

  @Field({ nullable: true })
  province: string;

  @Field({ nullable: true })
  district: string;

  @Field({ nullable: true })
  subDistrict: string;

  @Field({ nullable: true })
  postcode: string;

  @Field(() => File, { nullable: true })
  profileImage: File;
}

@InputType()
export class UpdateUserInput {
  @Field()
  id: string;

  @Field({ nullable: true })
  userNumber: string;

  @Field({ nullable: true })
  userType: TUserType;

  @Field({ nullable: true })
  username: string;

  @Field({ nullable: true })
  password: string;

  @Field({ nullable: true })
  registration: TRegistration;

  @Field(type => Int, { nullable: true })
  acceptPolicyVersion: number;

  @Field({ nullable: true })
  acceptPolicyTime: string;

  // Both
  @Field({ nullable: true })
  email: string;

  @Field({ nullable: true })
  phoneNumbers: string;

  // Individual detail
  @Field({ nullable: true })
  title: string;

  @Field({ nullable: true })
  firstname: string;

  @Field({ nullable: true })
  lastname: string;

  @Field({ nullable: true })
  identityId: string;

  @Field({ nullable: true })
  address: string;

  @Field({ nullable: true })
  branch: string;

  @Field({ nullable: true })
  country: string;

  @Field({ nullable: true })
  province: string;

  @Field({ nullable: true })
  district: string;

  @Field({ nullable: true })
  subDistrict: string;

  @Field({ nullable: true })
  postcode: string;

  // Business
  @Field({ nullable: true })
  corporateTitles: string;

  @Field({ nullable: true })
  corporateName: string;

  @Field({ nullable: true })
  taxId: string;

  @Field({ nullable: true })
  corporateBranch: string;

  @Field()
  businessType: string;

  @Field({ nullable: true })
  businessTypeOther: string;

  @Field({ nullable: true })
  documentBusinessRegisterCertification: string;

  @Field({ nullable: true })
  documentValueAddedTaxRegistrationCertification: string;

  @Field({ nullable: true })
  documentCopyAuthorizedSignatoryIDCard: string;
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
}