import { ObjectType, Field, Int } from 'type-graphql'
import { User } from '@models/user.model'
import { IndividualCustomer } from '@models/customerIndividual.model'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { Admin } from '@models/admin.model'
import { PaginateResult } from 'mongoose'
import { PaginationPayload } from './pagination.payloads'

@ObjectType()
export class UserPayload {
    @Field(() => User)
    user: User

    @Field(() => IndividualCustomer, { nullable: true })
    individualDetail?: IndividualCustomer

    @Field(() => BusinessCustomer, { nullable: true })
    businessDetail?: BusinessCustomer

    @Field(() => Admin, { nullable: true })
    adminDetail?: Admin
}

@ObjectType()
export class AdminPayload {
    @Field(() => User)
    user: User

    @Field(() => Admin)
    adminDetail: Admin
}

@ObjectType()
export class AuthPayload {
    @Field()
    token: string

    @Field(() => UserPayload)
    detail: UserPayload
}

@ObjectType()
export class UserPaginationPayload extends PaginationPayload implements PaginateResult<User> {
    @Field(() => [User])
    docs: User[]
}