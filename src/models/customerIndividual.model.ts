import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";
import { find, get } from "lodash";

@ObjectType()
export class IndividualCustomer {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true, sparse: true })
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
    const title = get(this, '_doc.title', '') || get(this, 'title', '')
    const otherTitle = get(this, '_doc.otherTitle', '') || get(this, 'otherTitle', '')
    const firstname = get(this, '_doc.firstname', '') || get(this, 'firstname', '')
    const lastname = get(this, '_doc.lastname', '') || get(this, 'lastname', '')

    const INDIVIDUAL_TITLE_NAME_OPTIONS = [
      { value: 'Miss', label: 'นางสาว' },
      { value: 'Mrs.', label: 'นาง' },
      { value: 'Mr.', label: 'นาย' },
      { value: 'other', label: 'อื่นๆ' },
    ]
    const titleName = title !== 'other' ? find(INDIVIDUAL_TITLE_NAME_OPTIONS, ['value', title]).label : otherTitle

    return `${titleName}${firstname} ${lastname}`;
  }

  static async findByUserNumber(userNumber: string): Promise<IndividualCustomer | null> {
    return IndividualCustomerModel.findOne({ userNumber });
  }
}

const IndividualCustomerModel = getModelForClass(IndividualCustomer);

export default IndividualCustomerModel;
