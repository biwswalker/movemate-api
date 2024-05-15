import { ObjectType, Field, ID, Int } from "type-graphql";
import { prop as Property, getModelForClass } from "@typegoose/typegoose";
import { IsNotEmpty, IsString, IsEnum } from "class-validator";
import bcrypt from "bcrypt";
import cryptoJs from "crypto-js";

enum EUserType {
  INDIVIDUAL = "individual",
  BUSINESS = "business",
}

enum EUserStatus {
  ACTIVE = "active",
  BANNED = "banned",
}

enum EUserValidationStatus {
  PENDING = "pending",
  APPROVE = "approve",
  DENIED = "denied",
}

enum ERegistration {
  WEB = "web",
  APP = "app",
}

@ObjectType()
export class User {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  user_number: string;

  @Field()
  @IsEnum(EUserType)
  @IsNotEmpty()
  @Property({ enum: EUserType, default: EUserType.INDIVIDUAL, required: true })
  user_type: TUserType;

  @Field()
  @Property({ required: true, unique: true })
  username: string;

  @Property({ required: true })
  password: string;

  @Field({ nullable: true })
  @Property()
  remark: string;

  @Field()
  @IsEnum(EUserStatus)
  @IsNotEmpty()
  @Property({ required: true, enum: EUserStatus, default: EUserStatus.ACTIVE })
  status: TUserStatus;

  @Field()
  @IsEnum(EUserValidationStatus)
  @IsNotEmpty()
  @Property({
    required: true,
    enum: EUserValidationStatus,
    default: EUserValidationStatus.PENDING,
  })
  validation_status: TUserValidationStatus;

  @Field()
  @IsEnum(ERegistration)
  @IsNotEmpty()
  @Property({ required: true, enum: ERegistration, default: ERegistration.WEB })
  registration: TRegistration;

  @Field({ nullable: true })
  @Property()
  lastest_OTP: string;

  @Field({ nullable: true })
  @Property()
  lastest_OTP_ref: string;

  @Field()
  @Property()
  is_verified_email: boolean;

  @Field()
  @Property()
  is_verified_phone_number: boolean;

  @Field((type) => Int)
  @Property({ required: true })
  accept_policy_version: number;

  @Field()
  @Property({ required: true })
  accept_policy_time: string;

  @Field()
  @Property({ default: Date.now })
  created_at: Date;

  @Field()
  @Property({ default: Date.now })
  updated_at: Date;

  async validatePassword(password: string): Promise<boolean> {
    const password_decryption = cryptoJs.AES.decrypt(
      password,
      process.env.MOVEMATE_SHARED_KEY
    ).toString();
    console.log(password, password_decryption, this.password)
    return bcrypt.compare(password_decryption, this.password);
  }

  static async findByUsername(username: string): Promise<User | null> {
    return UserModel.findOne({ username });
  }
}

const UserModel = getModelForClass(User);

export default UserModel;
