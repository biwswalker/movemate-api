import { ArgsType, Field, InputType } from 'type-graphql'

@ArgsType()
export class GetOTPArgs {
  @Field()
  phoneNumber: string;
}

@InputType()
export class RegisterOTPInput {
  @Field()
  otp: string

  @Field()
  ref: string

  @Field()
  phoneNumber: string
}