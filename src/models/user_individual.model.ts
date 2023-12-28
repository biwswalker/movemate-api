import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Severity, getModelForClass } from '@typegoose/typegoose'
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator'

@ObjectType()
export class IndividualUser {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsString()
    @IsNotEmpty()
    @Property({ required: true, unique: true })
    user_number: string

    @Field()
    @IsEmail()
    @IsNotEmpty()
    @Property({ required: true })
    email: string

    @Field()
    @IsString()
    @Property({ required: true })
    title: string

    @Field()
    @IsString()
    @Property({ required: true })
    firstname: string

    @Field()
    @IsString()
    @Property({ required: true })
    lastname: string

    @Field()
    @Property({ required: true })
    phone_numbers: string

    // @Field(() => [String])
    // @Property({ required: true, allowMixed: Severity.ALLOW })
    // phone_numbers: string[]

    @Field({ nullable: true })
    @IsString()
    @Length(13)
    @Property()
    identity_id: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    address: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    branch: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    country: string

    @Field({ nullable: true })
    @Property()
    province: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    district: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    sub_district: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    postcode: string
}

const IndividualUserModel = getModelForClass(IndividualUser)

export default IndividualUserModel