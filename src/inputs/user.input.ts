import { IsEmail } from "class-validator";
import { Field, InputType } from "type-graphql";

@InputType()
export class RegisterIndividualInput {
  @Field()
  user_type: TUserType;

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
}

@InputType()
export class CashPaymentInput {
  @Field()
  accepted_ereceipt_date: Date;
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

  @Field({ nullable: true })
  financial_address: string;

  @Field({ nullable: true })
  financial_postcode: string;

  @Field({ nullable: true })
  financial_province: string;

  @Field({ nullable: true })
  financial_district: string;

  @Field({ nullable: true })
  financial_sub_district: string;

  @Field({ nullable: true })
  billed_date: string;

  @Field({ nullable: true })
  billed_round: string;

  @Field({ nullable: true })
  accepted_first_credit_term_date: string;

  @Field({ nullable: true })
  business_registration_certificate_file_id: string;

  @Field({ nullable: true })
  copy_ID_authorized_signatory_file_id: string;

  @Field({ nullable: true })
  certificate_value_added_tax_refistration_file_id: string;
}

@InputType()
export class RegisterBusinessInput {
  @Field()
  business_titles: string;

  @Field()
  business_name: string;

  @Field()
  business_branch: string;

  @Field()
  business_type: string;

  @Field()
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

  @Field()
  accepted_policies_version: string;

  @Field()
  accepted_policies_date: Date;

  @Field()
  accepted_term_condition_version: string;

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

  @Field()
  accept_policy_version: string;

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

  @Field({ nullable: true })
  accept_policy_version: string;

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
