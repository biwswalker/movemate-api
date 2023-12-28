import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { IsNotEmpty, IsString, IsEnum } from 'class-validator'
import bcrypt from 'bcrypt'

enum EUserType {
    INDIVIDUAL = 'individual',
    BUSINESS = 'business',
}

enum EUserStatus {
    ACTIVE = 'active',
    BANNED = 'banned',
}

enum EUserValidationStatus {
    VALIDATING = 'validating',
    APPROVE = 'approve',
    REJECT = 'reject',
}

enum ERegistration {
    WEB = 'web',
    APP = 'app',
}

@ObjectType()
export class User {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsString()
    @IsNotEmpty()
    @Property({ required: true, unique: true })
    user_number: string

    @Field()
    @IsEnum(EUserType)
    @IsNotEmpty()
    @Property({ enum: EUserType, default: EUserType.INDIVIDUAL, required: true })
    user_type: TUserType

    @Field()
    @Property({ required: true, unique: true })
    username: string

    @Property({ required: true })
    password: string


    @Field({ nullable: true })
    @Property()
    remark: string

    @Field()
    @IsEnum(EUserStatus)
    @IsNotEmpty()
    @Property({ required: true, enum: EUserStatus, default: EUserStatus.ACTIVE })
    status: TUserStatus

    @Field()
    @IsEnum(EUserValidationStatus)
    @IsNotEmpty()
    @Property({ required: true, enum: EUserValidationStatus, default: EUserValidationStatus.VALIDATING })
    validation_status: TUserValidationStatus

    @Field()
    @IsEnum(ERegistration)
    @IsNotEmpty()
    @Property({ required: true, enum: ERegistration, default: ERegistration.WEB })
    registration: TRegistration

    @Field({ nullable: true })
    @Property()
    lastest_OTP: string

    @Field({ nullable: true })
    @Property()
    lastest_OTP_ref: string

    @Field()
    @Property()
    is_verified_email: boolean

    @Field()
    @Property()
    is_verified_phone_number: boolean

    @Field()
    @Property({ required: true })
    accept_policy_version: string

    @Field()
    @Property({ required: true })
    accept_policy_time: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date

    async validatePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password)
    }

    static async findByUsername(username: string): Promise<User | null> {
        return UserModel.findOne({ username })
    }
}

const UserModel = getModelForClass(User)

export default UserModel