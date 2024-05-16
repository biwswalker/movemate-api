import { ObjectType, Field } from 'type-graphql'
import { User } from '@models/user.model'
import { IndividualCustomer } from '@models/customerIndividual.model'
import { BusinessCustomer } from '@models/customerBusiness.model'

@ObjectType()
export class UserPayload {
    @Field(() => User)
    user: User

    @Field(() => IndividualCustomer, { nullable: true })
    individualDetail?: IndividualCustomer

    @Field(() => BusinessCustomer, { nullable: true })
    businessDetail?: BusinessCustomer
}

@ObjectType()
export class AuthPayload {
    @Field()
    token: string

    @Field(() => UserPayload)
    detail: UserPayload
}

