import { EDriverType } from "@enums/users";
import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class RegisterPayload {
  @Field()
  phoneNumber: string

  @Field(() => EDriverType)
  driverType: EDriverType
}

@ObjectType()
export class DriverVerifiedPayload {
  @Field(() => Int)
  policyVersion: number;

  @Field(() => EDriverType)
  driverType: EDriverType;

  @Field()
  title: string;

  @Field({ nullable: true })
  otherTitle?: string;

  @Field({ nullable: true })
  firstname: string;

  @Field({ nullable: true })
  lastname: string;

  @Field({ nullable: true })
  businessName: string;

  @Field({ nullable: true })
  businessBranch: string;

  @Field()
  taxNumber: string;

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

  @Field(() => [String])
  serviceVehicleTypes: string[]
}

@ObjectType()
export class EmployeeDetailPayload {
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

  @Field(() => [String])
  serviceVehicleTypes: string[]
}
