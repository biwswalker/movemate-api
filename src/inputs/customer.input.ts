import { IsEmail } from 'class-validator'
import { ArgsType, Field, Float, InputType, Int } from 'type-graphql'
import { FileInput } from './file.input'
import { EPaymentMethod } from '@enums/payments'
import { ECreditBillingCycleType, EUserStatus, EUserType } from '@enums/users'

@InputType()
export class RegisterIndividualInput {
  @Field()
  @IsEmail()
  email: string

  @Field()
  title: string

  @Field({ nullable: true })
  otherTitle: string

  @Field()
  firstname: string

  @Field()
  lastname: string

  @Field()
  phoneNumber: string

  @Field({ nullable: true })
  taxId: string

  @Field({ nullable: true })
  address: string

  @Field({ nullable: true })
  province: string

  @Field({ nullable: true })
  district: string

  @Field({ nullable: true })
  subDistrict: string

  @Field({ nullable: true })
  postcode: string
}

@InputType()
export class CashPaymentInput {
  @Field()
  acceptedEReceiptDate: Date
}

@InputType()
export class CreditPaymentInput {
  @Field()
  isSameAddress: boolean

  @Field()
  financialFirstname: string

  @Field()
  financialLastname: string

  @Field()
  financialContactNumber: string

  @Field(() => [String])
  financialContactEmails: string[]

  @Field()
  financialAddress: string

  @Field()
  financialPostcode: string

  @Field()
  financialProvince: string

  @Field()
  financialDistrict: string

  @Field()
  financialSubDistrict: string

  @Field()
  acceptedFirstCreditTermDate: Date

  @Field(() => FileInput)
  businessRegistrationCertificateFile: FileInput

  @Field(() => FileInput)
  copyIDAuthorizedSignatoryFile: FileInput

  @Field(() => FileInput, { nullable: true })
  certificateValueAddedTaxRegistrationFile: FileInput
}

@InputType()
export class RegisterBusinessInput {
  @Field()
  businessTitle: string

  @Field()
  businessName: string

  @Field({ nullable: true })
  businessBranch: string

  @Field()
  businessType: string

  @Field({ nullable: true })
  businessTypeOther: string

  @Field()
  taxNumber: string

  @Field()
  address: string

  @Field()
  province: string

  @Field()
  district: string

  @Field()
  subDistrict: string

  @Field()
  postcode: string

  @Field()
  contactNumber: string

  @Field()
  @IsEmail()
  businessEmail: string

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field()
  acceptedEDocumentDate: Date

  @Field((type) => Int)
  acceptedPoliciesVersion: number

  @Field()
  acceptedPoliciesDate: Date

  @Field((type) => Int)
  acceptedTermConditionVersion: number

  @Field()
  acceptedTermConditionDate: Date

  @Field(() => CashPaymentInput, { nullable: true })
  paymentCashDetail: CashPaymentInput

  @Field(() => CreditPaymentInput, { nullable: true })
  paymentCreditDetail: CreditPaymentInput
}

@InputType()
export class CutomerIndividualInput {
  @Field()
  userType: EUserType

  @Field()
  status: EUserStatus

  @Field({ nullable: true })
  remark: string

  @Field({ nullable: true })
  isVerifiedEmail: boolean

  @Field({ nullable: true })
  isVerifiedPhoneNumber: boolean

  @Field()
  @IsEmail()
  email: string

  @Field()
  title: string

  @Field({ nullable: true })
  otherTitle: string

  @Field()
  firstname: string

  @Field()
  lastname: string

  @Field()
  phoneNumber: string

  @Field({ nullable: true })
  taxId: string

  @Field({ nullable: true })
  address: string

  @Field({ nullable: true })
  province: string

  @Field({ nullable: true })
  district: string

  @Field({ nullable: true })
  subDistrict: string

  @Field({ nullable: true })
  postcode: string

  @Field(() => FileInput, { nullable: true })
  profileImage: FileInput
}

@InputType()
export class CashPaymentDetailInput {
  @Field()
  acceptedEReceipt: boolean

  @Field()
  acceptedEReceiptDate: string
}

@InputType()
export class MonthlyBillingCycleInput {
  @Field(() => Int)
  issueDate: number

  @Field(() => Int)
  dueDate: number

  @Field(() => Int)
  dueMonth: number
}

@InputType()
class YearBillingCycleInput {
  @Field(() => MonthlyBillingCycleInput)
  jan: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  feb: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  mar: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  apr: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  may: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  jun: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  jul: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  aug: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  sep: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  oct: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  nov: MonthlyBillingCycleInput

  @Field(() => MonthlyBillingCycleInput)
  dec: MonthlyBillingCycleInput
}

@InputType()
export class CreditPaymentDetailInput {
  @Field()
  acceptedFirstCreditTerm: boolean

  @Field()
  acceptedFirstCreditTermDate: string

  @Field(() => ECreditBillingCycleType)
  billingCycleType: ECreditBillingCycleType

  @Field(() => YearBillingCycleInput)
  billingCycle: YearBillingCycleInput

  @Field(() => Float)
  creditLimit: number

  @Field(() => Float, { nullable: true })
  creditUsage?: number

  @Field()
  financialAddress: string

  @Field(() => [String])
  financialContactEmails: string[]

  @Field()
  financialContactNumber: string

  @Field()
  financialDistrict: string

  @Field()
  financialFirstname: string

  @Field()
  financialLastname: string

  @Field()
  financialPostcode: string

  @Field()
  financialProvince: string

  @Field()
  financialSubDistrict: string

  @Field()
  isSameAddress: boolean

  @Field(() => FileInput, { nullable: true })
  businessRegistrationCertificateFile: FileInput

  @Field(() => FileInput, { nullable: true })
  copyIDAuthorizedSignatoryFile: FileInput

  @Field(() => FileInput, { nullable: true })
  certificateValueAddedTaxRegistrationFile?: FileInput
}

@InputType()
export class CutomerBusinessInput {
  @Field()
  userType: EUserType

  @Field()
  status: EUserStatus

  @Field({ nullable: true })
  remark: string

  @Field({ nullable: true })
  isVerifiedEmail: boolean

  @Field({ nullable: true })
  isVerifiedPhoneNumber: boolean

  @Field(() => FileInput, { nullable: true })
  profileImage: FileInput

  @Field()
  @IsEmail()
  businessEmail: string

  @Field()
  businessTitle: string

  @Field()
  businessName: string

  @Field()
  businessBranch: string

  @Field()
  businessType: string

  @Field()
  businessTypeOther: string

  @Field()
  contactNumber: string

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field()
  taxNumber: string

  @Field()
  address: string

  @Field()
  province: string

  @Field()
  district: string

  @Field()
  subDistrict: string

  @Field()
  postcode: string

  @Field(() => CashPaymentDetailInput, { nullable: true })
  cashPayment?: CashPaymentDetailInput

  @Field(() => CreditPaymentDetailInput, { nullable: true })
  creditPayment?: CreditPaymentDetailInput

  @Field({ nullable: true })
  acceptedEDocumentDate?: Date

  @Field({ nullable: true })
  acceptedPoliciesDate?: Date

  @Field({ nullable: true })
  acceptedTermConditionDate?: Date
}

@InputType()
export class AcceptedPolicyInput {
  @Field(() => Int)
  version: number
}

@InputType()
export class PasswordChangeInput {
  @Field()
  password: string

  @Field()
  confirmPassword: string
}

@ArgsType()
export class ResetPasswordInput {
  @Field()
  username: string

  @Field()
  code: string

  @Field()
  password: string
}
