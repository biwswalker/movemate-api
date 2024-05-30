import { IsEmail } from "class-validator";
import { Field, InputType, Int } from "type-graphql";
import { File } from "models/file.model";
@InputType()
export class RegisterIndividualInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  otherTitle: string;

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
}

@InputType()
export class CashPaymentInput {
  @Field()
  acceptedEReceiptDate: Date;
}

@InputType()
export class FileInput {
  @Field()
  fileId: string;

  @Field()
  filename: string;

  @Field()
  mimetype: string;
}

@InputType()
export class CreditPaymentInput {
  @Field()
  isSameAddress: boolean;

  @Field()
  financialFirstname: string;

  @Field()
  financialLastname: string;

  @Field()
  financialContactNumber: string;

  @Field(() => [String])
  financialContactEmails: string[];

  @Field()
  financialAddress: string;

  @Field()
  financialPostcode: string;

  @Field()
  financialProvince: string;

  @Field()
  financialDistrict: string;

  @Field()
  financialSubDistrict: string;

  @Field()
  acceptedFirstCreditTermDate: Date;

  @Field(() => FileInput)
  businessRegistrationCertificateFile: FileInput;

  @Field(() => FileInput)
  copyIDAuthorizedSignatoryFile: FileInput;

  @Field(() => FileInput, { nullable: true })
  certificateValueAddedTaxRegistrationFile: FileInput;
}

@InputType()
export class RegisterBusinessInput {
  @Field()
  businessTitle: string;

  @Field()
  businessName: string;

  @Field({ nullable: true })
  businessBranch: string;

  @Field()
  businessType: string;

  @Field({ nullable: true })
  businessTypeOther: string;

  @Field()
  taxNumber: string;

  @Field()
  address: string;

  @Field()
  province: string;

  @Field()
  district: string;

  @Field()
  subDistrict: string;

  @Field()
  postcode: string;

  @Field()
  contactNumber: string;

  @Field()
  @IsEmail()
  businessEmail: string;

  @Field()
  paymentMethod: string;

  @Field()
  acceptedEDocumentDate: Date;

  @Field((type) => Int)
  acceptedPoliciesVersion: number;

  @Field()
  acceptedPoliciesDate: Date;

  @Field((type) => Int)
  acceptedTermConditionVersion: number;

  @Field()
  acceptedTermConditionDate: Date;

  @Field(() => CashPaymentInput, { nullable: true })
  paymentCashDetail: CashPaymentInput;

  @Field(() => CreditPaymentInput, { nullable: true })
  paymentCreditDetail: CreditPaymentInput;
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

  @Field({ nullable: true })
  otherTitle: string;

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

  @Field(() => FileInput, { nullable: true })
  profileImage: FileInput;
}
