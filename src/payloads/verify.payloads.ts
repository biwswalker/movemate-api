import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class VerifyPayload {
    @Field(() => Date)
    countdown: Date

    @Field()
    duration: string
}

@ObjectType()
export class VerifyOTPPayload {
    @Field(() => Date)
    countdown: Date

    @Field()
    duration: string

    @Field()
    ref: string
}