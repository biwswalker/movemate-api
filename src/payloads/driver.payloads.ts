import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class RegisterPayload {
  @Field()
  phoneNumber: string

  @Field()
  driverType: string
}

@ObjectType()
export class IndividualDriverDetailVerifyPayload {
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