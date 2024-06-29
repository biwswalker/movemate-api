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

    @Field()
    linkedin: string

    @Field()
    linkedinLink: string
}

@InputType()
export class SettingBusinessTypeInput {
    @Field({ nullable: true })
    _id: string

    @Field()
    name: string
}

@InputType()
export class SettingFAQInput {
    @Field({ nullable: true })
    _id: string

    @Field()
    question: string

    @Field()
    answer: string
}

@InputType()
export class SettingInstructionInput {
    @Field({ nullable: true })
    _id: string

    @Field()
    page: string

    @Field()
    instructionTitle: string

    @Field()
    instruction: string
}
