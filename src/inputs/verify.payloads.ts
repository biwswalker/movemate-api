import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class VerifyOTPArgs {
    @Field()
    id: string;

    @Field()
    otp: string;

    @Field()
    ref: string;
}