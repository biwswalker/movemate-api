import { Field, InputType } from "type-graphql";

@InputType()
export class SettingContactUsInput {
    @Field()
    instructiontext: string

    @Field()
    address: string

    @Field()
    taxId: string

    @Field()
    email: string

    @Field()
    phoneNumber: string

    @Field()
    facebook: string

    @Field()
    facebookLink: string

    @Field()
    lineId: string

    @Field()
    lineLink: string
}