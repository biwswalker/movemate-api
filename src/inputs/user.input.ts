import { File } from "@models/file.model";
import { IsEmail } from "class-validator";
import { Field, InputType, Int } from "type-graphql";

@InputType()
export class RegisterIndividualInput {
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
  phone_number: string;

  @Field({ nullable: true })
  tax_id: string;

  @Field({ nullable: true })
  address: string;

  @Field({ nullable: true })
  province: string;

  @Field({ nullable: true })
  district: string;

  @Field({ nullable: true })
  sub_district: string;

  @Field({ nullable: true })
  postcode: string;
}

@InputType()
export class CashPaymentInput {
  @Field()
  accepted_ereceipt_date: Date;
}

@InputType()
export class FileInput {
  @Field()
  file_id: string

  @Field()
  filename: string

  @Field()
  mimetype: string
}

@InputType()
export class CreditPaymentInput {
  @Field()
  is_same_address: boolean;

  @Field()
  financial_firstname: string;

  @Field()
  financial_lastname: string;

  @Field()
  financial_contact_number: string;

  @Field(() => [String])
  financial_contact_emails: string[];

  @Field()
  financial_address: string;

  @Field()
  financial_postcode: string;

  @Field()
  financial_province: string;

  @Field()
  financial_district: string;

  @Field()
  financial_sub_district: string;

  @Field()
  accepted_first_credit_term_date: string;

  @Field(() => FileInput)
  business_registration_certificate_file: FileInput;

  @Field(() => FileInput)
  copy_ID_authorized_signatory_file: FileInput;

  @Field(() => FileInput, { nullable: true })
  certificate_value_added_tax_refistration_file: FileInput;
}

@InputType()
export class RegisterBusinessInput {
  @Field()
  business_titles: string;

  @Field()
  business_name: string;

  @Field({ nullable: true })
  business_branch: string;

  @Field()
  business_type: string;

  @Field({ nullable: true })
  business_type_other: string;

  @Field()
  tax_number: string;

  @Field()
  address: string;

  @Field()
  province: string;

  @Field()
  district: string;

  @Field()
  sub_district: string;

  @Field()
  postcode: string;

  @Field()
  contact_number: string;

  @Field()
  @IsEmail()
  business_email: string;

  @Field()
  payment_method: string;

  @Field()
  accepted_edocument_date: Date;

  @Field(type => Int)
  accepted_policies_version: number;

  @Field()
  accepted_policies_date: Date;

  @Field(type => Int)
  accepted_term_condition_version: number;

  @Field()
  accepted_term_condition_date: Date;

  @Field(() => CashPaymentInput, { nullable: true })
  payment_cash_detail: CashPaymentInput;

  @Field(() => CreditPaymentInput, { nullable: true })
  payment_credit_detail: CreditPaymentInput;
}

@InputType()
export class RegisterInput {
  @Field()
  user_type: TUserType;

  @Field()
  password: string;

  @Field({ nullable: true })
  remark: string;

  @Field(type => Int)
  accept_policy_version: number;

  @Field()
  accept_policy_time: string;

  @Field(() => RegisterIndividualInput, { nullable: true })
  individual_detail: RegisterIndividualInput;

  @Field(() => RegisterBusinessInput, { nullable: true })
  business_detail: RegisterBusinessInput;
}

@InputType()
export class UpdateUserInput {
  @Field()
  id: string;

  @Field({ nullable: true })
  user_number: string;

  @Field({ nullable: true })
  user_type: TUserType;

  @Field({ nullable: true })
  username: string;

  @Field({ nullable: true })
  password: string;

  @Field({ nullable: true })
  registration: TRegistration;

  @Field(type => Int, { nullable: true })
  accept_policy_version: number;

  @Field({ nullable: true })
  accept_policy_time: string;

  // Both
  @Field({ nullable: true })
  email: string;

  @Field({ nullable: true })
  phone_numbers: string;

  // Individual detail
  @Field({ nullable: true })
  title: string;

  @Field({ nullable: true })
  firstname: string;

  @Field({ nullable: true })
  lastname: string;

  @Field({ nullable: true })
  identity_id: string;

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
  sub_district: string;

  @Field({ nullable: true })
  postcode: string;

  // Business
  @Field({ nullable: true })
  corporate_titles: string;

  @Field({ nullable: true })
  corporate_name: string;

  @Field({ nullable: true })
  tax_id: string;

  @Field({ nullable: true })
  corporate_branch: string;

  @Field()
  business_type: string;

  @Field({ nullable: true })
  business_type_other: string;

  @Field({ nullable: true })
  document_business_register_certification: string;

  @Field({ nullable: true })
  document_value_added_tax_registration_certification: string;

  @Field({ nullable: true })
  document_copy_authorized_signatory_ID_card: string;
}

@InputType()
export class UpdateBusinessDetailInput {
  @Field()
  user_number: string;

  @Field()
  transport_supervisor_phone_number: string;

  @Field()
  transport_supervisor_email: string;

  @Field()
  accounting_phone_number: string;

  @Field()
  accounting_email: string;

  @Field()
  accounting_address: string;

  @Field({ nullable: true })
  accounting_country: string;

  @Field()
  accounting_province: string;

  @Field()
  accounting_district: string;

  @Field()
  accounting_sub_diatrict: string;

  @Field()
  accounting_postcode: string;

  @Field()
  credit_term: boolean;

  @Field({ nullable: true })
  credit_limit: string;

  @Field({ nullable: true })
  credit_amount: string;

  @Field({ nullable: true })
  billed_type: string;

  @Field({ nullable: true })
  date_of_billed: string;

  @Field({ nullable: true })
  payment_duedate_type: string;

  @Field({ nullable: true })
  date_of_payment_duedate: string;

  @Field()
  is_accept_e_documents: boolean;
}
