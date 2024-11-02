import { ArgsType, Field, InputType, Int } from 'type-graphql'
import { RegisterBusinessInput, RegisterIndividualInput } from './customer.input'
import { ERegistration, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'

@InputType()
export class RegisterInput {
  @Field(() => EUserType)
  userType: EUserType

  @Field()
  password: string

  @Field({ nullable: true })
  remark: string

  @Field((type) => Int)
  acceptPolicyVersion: number

  @Field()
  acceptPolicyTime: Date

  @Field(() => RegisterIndividualInput, { nullable: true })
  individualDetail: RegisterIndividualInput

  @Field(() => RegisterBusinessInput, { nullable: true })
  businessDetail: RegisterBusinessInput
}

@InputType()
export class UpdateBusinessDetailInput {
  @Field()
  userNumber: string

  @Field()
  transportSupervisorPhoneNumber: string

  @Field()
  transportSupervisorEmail: string

  @Field()
  accountingPhoneNumber: string

  @Field()
  accountingEmail: string

  @Field()
  accountingAddress: string

  @Field({ nullable: true })
  accountingCountry: string

  @Field()
  accountingProvince: string

  @Field()
  accountingDistrict: string

  @Field()
  accountingSubDiatrict: string

  @Field()
  accountingPostcode: string

  @Field()
  creditTerm: boolean

  @Field({ nullable: true })
  creditLimit: string

  @Field({ nullable: true })
  creditAmount: string

  @Field({ nullable: true })
  billedType: string

  @Field({ nullable: true })
  dateOfBilled: string

  @Field({ nullable: true })
  paymentDuedateType: string

  @Field({ nullable: true })
  dateOfPaymentDuedate: string

  @Field()
  isAcceptEDocuments: boolean
}

@ArgsType()
export class GetUserArgs {
  @Field({ nullable: true })
  _id?: string

  @Field({ nullable: true })
  userNumber: string

  @Field(() => EUserRole, { nullable: true })
  userRole: EUserRole

  @Field(() => EUserType, { nullable: true })
  userType: EUserType

  @Field({ nullable: true })
  username: string

  @Field(() => EUserStatus, { nullable: true })
  status: EUserStatus

  @Field(() => EUserValidationStatus, { nullable: true })
  validationStatus: EUserValidationStatus

  @Field(() => ERegistration, { nullable: true })
  registration: ERegistration

  @Field({ nullable: true })
  lastestOTP: string

  @Field({ nullable: true })
  lastestOTPRef: string

  @Field({ nullable: true })
  isVerifiedEmail: boolean

  @Field({ nullable: true })
  isVerifiedPhoneNumber: boolean

  // Other
  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  phoneNumber: string

  @Field({ nullable: true })
  taxId: string

  // Driver
  @Field({ nullable: true })
  lineId: string

  @Field(() => String, { nullable: true })
  serviceVehicleType: string

  @Field(() => String, { nullable: true })
  parentId?: string
}
