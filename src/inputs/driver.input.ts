import { Field, InputType, Int } from 'type-graphql'
import { FileInput } from './file.input'
import { RegisterOTPInput } from './otp.input'
import { EDriverType } from '@enums/users'

@InputType()
export class DriverDetailInput {
  @Field(() => Int)
  policyVersion: number

  @Field(() => EDriverType)
  driverType: EDriverType

  @Field()
  title: string

  @Field({ nullable: true })
  otherTitle?: string

  @Field({ nullable: true })
  firstname: string

  @Field({ nullable: true })
  lastname: string

  @Field({ nullable: true })
  businessName: string

  @Field({ nullable: true })
  businessBranch: string
  
  @Field()
  taxNumber: string

  @Field()
  phoneNumber: string

  @Field({ nullable: true })
  lineId: string

  @Field()
  password: string

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
  bank: string

  @Field()
  bankBranch: string

  @Field()
  bankName: string

  @Field()
  bankNumber: string

  @Field(() => [String])
  serviceVehicleTypes: string[]
}

@InputType()
export class DriverDocumentInput {
  @Field(() => FileInput, { nullable: true })
  frontOfVehicle: FileInput

  @Field(() => FileInput, { nullable: true })
  backOfVehicle: FileInput

  @Field(() => FileInput, { nullable: true })
  leftOfVehicle: FileInput

  @Field(() => FileInput, { nullable: true })
  rigthOfVehicle: FileInput

  @Field(() => FileInput, { nullable: true })
  copyVehicleRegistration: FileInput

  @Field(() => FileInput, { nullable: true })
  copyIDCard: FileInput

  @Field(() => FileInput, { nullable: true })
  copyDrivingLicense: FileInput

  @Field(() => FileInput, { nullable: true })
  copyBookBank?: FileInput

  @Field(() => FileInput, { nullable: true })
  copyHouseRegistration?: FileInput

  @Field(() => FileInput, { nullable: true })
  insurancePolicy?: FileInput

  @Field(() => FileInput, { nullable: true })
  criminalRecordCheckCert?: FileInput

  @Field(() => FileInput, { nullable: true })
  businessRegistrationCertificate?: FileInput

  @Field(() => FileInput, { nullable: true })
  certificateValueAddedTaxRegistration?: FileInput
}

@InputType()
export class DriverRegisterInput {
  @Field(() => DriverDetailInput)
  detail: DriverDetailInput

  @Field(() => DriverDocumentInput)
  documents: DriverDocumentInput

  @Field(() => RegisterOTPInput)
  otp: RegisterOTPInput
}


@InputType()
export class EmployeeDetailInput {
  @Field()
  title: string

  @Field({ nullable: true })
  otherTitle?: string

  @Field({ nullable: true })
  firstname: string

  @Field({ nullable: true })
  lastname: string
  
  @Field()
  taxNumber: string

  @Field()
  phoneNumber: string

  @Field({ nullable: true })
  lineId: string

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
}

@InputType()
export class EmployeeRegisterInput {
  @Field(() => EmployeeDetailInput)
  detail?: EmployeeDetailInput;

  @Field(() => DriverDocumentInput)
  documents?: DriverDocumentInput;
}
