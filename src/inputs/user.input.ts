import { Field, InputType } from 'type-graphql'

@InputType()
export class RegisterInput {
    @Field()
    user_type: TUserType

    @Field()
    username: string

    @Field()
    password: string

    @Field()
    registration: TRegistration

    @Field()
    accept_policy_version: string

    @Field()
    accept_policy_time: string

    // Both
    @Field()
    email: string

    @Field()
    phone_numbers: string

    // Individual detail
    @Field({ nullable: true })
    title: string

    @Field({ nullable: true })
    firstname: string

    @Field({ nullable: true })
    lastname: string

    @Field({ nullable: true })
    identity_id: string

    @Field({ nullable: true })
    address: string

    @Field({ nullable: true })
    branch: string

    @Field({ nullable: true })
    country: string

    @Field({ nullable: true })
    province: string

    @Field({ nullable: true })
    district: string

    @Field({ nullable: true })
    sub_district: string

    @Field({ nullable: true })
    postcode: string

    // Business
    @Field({ nullable: true })
    corporate_titles: string

    @Field({ nullable: true })
    corporate_name: string

    @Field({ nullable: true })
    tax_id: string

    @Field({ nullable: true })
    corporate_branch: string

    @Field()
    business_type: string

    @Field({ nullable: true })
    business_type_other: string

    @Field({ nullable: true })
    document_business_register_certification: string

    @Field({ nullable: true })
    document_value_added_tax_registration_certification: string

    @Field({ nullable: true })
    document_copy_authorized_signatory_ID_card: string
}

@InputType()
export class UpdateUserInput {

    @Field({ nullable: true })
    user_number: string

    @Field({ nullable: true })
    user_type: TUserType

    @Field({ nullable: true })
    username: string

    @Field({ nullable: true })
    password: string

    @Field({ nullable: true })
    registration: TRegistration

    @Field({ nullable: true })
    accept_policy_version: string

    @Field({ nullable: true })
    accept_policy_time: string

    // Both
    @Field({ nullable: true })
    email: string

    @Field({ nullable: true })
    phone_numbers: string

    // Individual detail
    @Field({ nullable: true })
    title: string

    @Field({ nullable: true })
    firstname: string

    @Field({ nullable: true })
    lastname: string

    @Field({ nullable: true })
    identity_id: string

    @Field({ nullable: true })
    address: string

    @Field({ nullable: true })
    branch: string

    @Field({ nullable: true })
    country: string

    @Field({ nullable: true })
    province: string

    @Field({ nullable: true })
    district: string

    @Field({ nullable: true })
    sub_district: string

    @Field({ nullable: true })
    postcode: string

    // Business
    @Field({ nullable: true })
    corporate_titles: string

    @Field({ nullable: true })
    corporate_name: string

    @Field({ nullable: true })
    tax_id: string

    @Field({ nullable: true })
    corporate_branch: string

    @Field()
    business_type: string

    @Field({ nullable: true })
    business_type_other: string

    @Field({ nullable: true })
    document_business_register_certification: string

    @Field({ nullable: true })
    document_value_added_tax_registration_certification: string

    @Field({ nullable: true })
    document_copy_authorized_signatory_ID_card: string
}


@InputType()
export class UpdateBusinessDetailInput {

    @Field()
    user_number: string

    @Field()
    transport_supervisor_phone_number: string

    @Field()
    transport_supervisor_email: string

    @Field()
    accounting_phone_number: string

    @Field()
    accounting_email: string

    @Field()
    accounting_address: string

    @Field({ nullable: true })
    accounting_country: string

    @Field()
    accounting_province: string

    @Field()
    accounting_district: string

    @Field()
    accounting_sub_diatrict: string

    @Field()
    accounting_postcode: string

    @Field()
    credit_term: boolean

    @Field({ nullable: true })
    credit_limit: string

    @Field({ nullable: true })
    credit_amount: string

    @Field({ nullable: true })
    billed_type: string

    @Field({ nullable: true })
    date_of_billed: string

    @Field({ nullable: true })
    payment_duedate_type: string

    @Field({ nullable: true })
    date_of_payment_duedate: string

    @Field()
    is_accept_e_documents: boolean

}