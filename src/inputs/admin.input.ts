import { Field, InputType } from "type-graphql";
import { IsEmail } from "class-validator";

@InputType()
export class AddAdminInput {
    @Field()
    permission: TAdminPermission

    @Field()
    @IsEmail()
    email: string;

    @Field()
    title: string;

    @Field()
    firstname: string;

    @Field()
    lastname: string;

    @Field()
    phoneNumber: string;

    @Field({ nullable: true })
    taxId: string;

    @Field({ nullable: true })
    address: string;

    @Field({ nullable: true })
    province: string;

    @Field({ nullable: true })
    district: string;

    @Field({ nullable: true })
    subDistrict: string;

    @Field({ nullable: true })
    postcode: string;
}