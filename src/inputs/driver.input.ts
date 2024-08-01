import { Field, InputType, Int, ObjectType } from 'type-graphql'
import { FileInput } from './file.input';
import { RegisterOTPInput } from './otp.input';

@InputType()
export class IndividualDriverDetailInput {
  @Field(() => Int)
  policyVersion: number;

  @Field()
  driverType: TUserType;

  @Field()
  title: string;

  @Field({ nullable: true })
  otherTitle?: string;

  @Field()
  firstname: string;

  @Field()
  lastname: string;

  @Field()
  taxId: string;

  @Field()
  phoneNumber: string;

  @Field()
  lineId: string;

  @Field()
  password: string;

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
  bank: string;

  @Field()
  bankBranch: string;

  @Field()
  bankName: string;

  @Field()
  bankNumber: string;

  @Field()
  serviceVehicleType: string;
}

@InputType()
export class DriverDocumentInput {
  @Field(() => FileInput)
  frontOfVehicle: FileInput

  @Field(() => FileInput)
  backOfVehicle: FileInput

  @Field(() => FileInput)
  leftOfVehicle: FileInput

  @Field(() => FileInput)
  rigthOfVehicle: FileInput

  @Field(() => FileInput)
  copyVehicleRegistration: FileInput

  @Field(() => FileInput)
  copyIDCard: FileInput

  @Field(() => FileInput)
  copyDrivingLicense: FileInput

  @Field(() => FileInput, { nullable: true })
  copyBookBank?: FileInput

  @Field(() => FileInput, { nullable: true })
  copyHouseRegistration?: FileInput

  @Field(() => FileInput, { nullable: true })
  insurancePolicy?: FileInput

  @Field(() => FileInput, { nullable: true })
  criminalRecordCheckCert?: FileInput
}

@InputType()
export class IndividualDriverRegisterInput {
  @Field(() => IndividualDriverDetailInput)
  detail: IndividualDriverDetailInput

  @Field(() => DriverDocumentInput)
  documents: DriverDocumentInput

  @Field(() => RegisterOTPInput)
  otp: RegisterOTPInput
}