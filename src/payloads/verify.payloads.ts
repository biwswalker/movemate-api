import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class VerifyPayload {
    @Field(() => Date)
    countdown: Date

    @Field()
    duration: string
}