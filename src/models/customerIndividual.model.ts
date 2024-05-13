import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

@ObjectType()
export class IndividualCustomer {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  user_number: string;

  @Field()
  @IsEmail()
  @IsNotEmpty()
  @Property({ required: true })
  email: string;

  @Field()
  @IsString()
  @Property({ required: true })
  title: string;

  @Field()
  @IsString()
  @Property({ required: true })
  firstname: string;

  @Field()
  @IsString()
  @Property({ required: true })
  lastname: string;

  @Field()
  @Property({ required: true })
  phone_number: string;

  // @Field(() => [String])
  // @Property({ required: true, allowMixed: Severity.ALLOW })
  // phone_numbers: string[]

  @Field({ nullable: true })
  @IsString()
  @Length(13)
  @Property()
  tax_id: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  address: string;

  @Field({ nullable: true })
  @Property()
  province: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  district: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  sub_district: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  postcode: string;
}

const IndividualCustomerModel = getModelForClass(IndividualCustomer);

export default IndividualCustomerModel;
