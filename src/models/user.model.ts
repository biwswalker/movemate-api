import { ObjectType, Field, ID, Int } from "type-graphql";
import { prop as Property, Ref, getModelForClass, plugin } from "@typegoose/typegoose";
import autopopulate from 'mongoose-autopopulate'
import { IsNotEmpty, IsString, IsEnum } from "class-validator";
import bcrypt from "bcrypt";
import cryptoJs from "crypto-js";
import mongoosePagination from 'mongoose-paginate-v2'
import mongoose from "mongoose";
import { Admin } from "./admin.model";
import { IndividualCustomer } from "./customerIndividual.model";
import { BusinessCustomer } from "./customerBusiness.model";
import { File } from "./file.model"
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";

enum EUserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  DRIVER = 'driver'
}

enum EUserType {
  INDIVIDUAL = "individual",
  BUSINESS = "business",
}

enum EUserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
  BANNED = "banned",
  DENIED = "denied",
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

@plugin(autopopulate)
@plugin(mongoosePagination)
@ObjectType()
export class User extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true, unique: true })
  userNumber: string;

  @Field()
  @IsEnum(EUserRole)
  @IsNotEmpty()
  @Property({ enum: EUserRole, default: EUserRole.CUSTOMER, required: true })
  userRole: TUserRole;

  @Field()
  @IsEnum(EUserType)
  @IsNotEmpty()
  @Property({ enum: EUserType, default: EUserType.INDIVIDUAL, required: true })
  userType: TUserType;

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
  validationStatus: TUserValidationStatus;

  @Field()
  @IsEnum(ERegistration)
  @IsNotEmpty()
  @Property({ required: true, enum: ERegistration, default: ERegistration.WEB })
  registration: TRegistration;

  @Field({ nullable: true })
  @Property()
  lastestOTP: string;

  @Field({ nullable: true })
  @Property()
  lastestOTPRef: string;

  @Field()
  @Property()
  isVerifiedEmail: boolean;

  @Field()
  @Property()
  isVerifiedPhoneNumber: boolean;

  @Field((type) => Int, { nullable: true })
  @Property()
  acceptPolicyVersion: number;

  @Field({ nullable: true })
  @Property()
  acceptPolicyTime: string;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;

  @Field(() => Admin, { nullable: true })
  @Property({ autopopulate: true, ref: 'Admin' })
  adminDetail?: Ref<Admin>

  @Field(() => IndividualCustomer, { nullable: true })
  @Property({ autopopulate: true, ref: 'IndividualCustomer' })
  individualDetail?: Ref<IndividualCustomer>

  @Field(() => BusinessCustomer, { nullable: true })
  @Property({ autopopulate: true, ref: 'BusinessCustomer' })
  businessDetail?: Ref<BusinessCustomer>

  @Field(() => File, { nullable: true })
  @Property({ autopopulate: true, ref: 'File' })
  profileImage?: Ref<File>

  async validatePassword(password: string): Promise<boolean> {
    const password_decryption = cryptoJs.AES.decrypt(
      password,
      process.env.MOVEMATE_SHARED_KEY
    ).toString();
    return bcrypt.compare(password_decryption, this.password);
  }

  static async findByUsername(username: string): Promise<User | null> {
    return UserModel.findOne({ username });
  }

  static paginate: mongoose.PaginateModel<typeof User>['paginate']
}

const UserModel = getModelForClass(User);

export default UserModel;
