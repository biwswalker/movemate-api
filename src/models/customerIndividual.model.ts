import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";
import { get } from "lodash";

@ObjectType()
export class IndividualCustomer {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  userNumber: string;

  @Field()
  @IsEmail()
  @IsNotEmpty()
  @Property({ required: true })
  email: string;

  @Field()
  @IsString()
  @Property({ required: true })
  title: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  otherTitle: string;

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
  phoneNumber: string;

  // @Field(() => [String])
  // @Property({ required: true, allowMixed: Severity.ALLOW })
  // phoneNumbers: string[]

  @Field({ nullable: true })
  @IsString()
  @Length(13)
  @Property()
  taxId: string;

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
  subDistrict: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
  postcode: string;

  @Field({ nullable: true })
  get fullname(): string {
    const firstname = get(this, '_doc.firstname', '') || get(this, 'firstname', '')
    const lastname = get(this, '_doc.lastname', '') || get(this, 'lastname', '')
    return `${firstname} ${lastname}`;
  }

  static async findByUserNumber(userNumber: string): Promise<IndividualCustomer | null> {
    return IndividualCustomerModel.findOne({ userNumber });
  }
}

const IndividualCustomerModel = getModelForClass(IndividualCustomer);

export default IndividualCustomerModel;
