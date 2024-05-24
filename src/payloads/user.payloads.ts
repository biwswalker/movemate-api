import { ObjectType, Field, Int } from 'type-graphql'
import { User } from '@models/user.model'
import { PaginateResult } from 'mongoose'
import { PaginationPayload } from './pagination.payloads'

@ObjectType()
export class AuthPayload {
    @Field()
    token: string

    @Field(() => User)
    user: User
}

@ObjectType()
export class UserPaginationPayload extends PaginationPayload implements PaginateResult<User> {
    @Field(() => [User])
    docs: User[]
}