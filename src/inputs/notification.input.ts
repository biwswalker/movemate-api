import { Field, InputType } from "type-graphql";

@InputType()
export class NotificationInput {
    @Field()
    userId: string

    @Field()
    varient: string

    @Field()
    title: string

    @Field()
    message: string

    @Field({ nullable: true })
    infoText?: string

    @Field({ nullable: true })
    infoLink?: string

    @Field({ nullable: true })
    errorText?: string
    
    @Field({ nullable: true })
    errorLink?: string

    @Field({ nullable: true })
    masterText?: string

    @Field({ nullable: true })
    masterLink?: string
}