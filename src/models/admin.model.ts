import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from "class-validator";
import { get } from "lodash";

enum EAdminPermission {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  OWNER = 'owner',
}

@ObjectType()
export class Admin {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  userNumber: string;

  @Field()
  @IsEnum(EAdminPermission)
  @IsNotEmpty()
  @Property({ enum: EAdminPermission, default: EAdminPermission.ADMIN, required: true })
  permission: TAdminPermission;

  @Field()
  @IsEmail()
  @IsNotEmpty()
  @Property({ required: true })
  email: string;

  @Field({ nullable: true })
  @IsString()
  @Property()
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
  phoneNumber: string;

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

  static async findByUserNumber(userNumber: string): Promise<Admin | null> {
    return AdminModel.findOne({ userNumber });
  }
}

const AdminModel = getModelForClass(Admin);

export default AdminModel;
