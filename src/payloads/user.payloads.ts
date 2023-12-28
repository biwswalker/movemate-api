import { ObjectType, Field } from 'type-graphql'
import { User } from '@models/user.model'

@ObjectType()
export class AuthPayload {
    @Field()
    token: string

    @Field(() => User)
    user: User
}