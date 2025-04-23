import { ObjectType, Field, Int } from 'type-graphql'
import { User } from '@models/user.model'
import { AggregatePaginateResult, PaginateResult } from 'mongoose'
import { PaginationPayload } from './pagination.payloads'
import { UserPending } from '@models/userPending.model'

@ObjectType()
export class AuthPayload {
  @Field()
  token: string

  @Field(() => User)
  user: User

  @Field()
  requireAcceptedPolicy: boolean

  @Field()
  requirePasswordChange: boolean
}

@ObjectType()
export class RequireDataBeforePayload {
  @Field()
  requireAcceptedPolicy: boolean

  @Field()
  requirePasswordChange: boolean
}

@ObjectType()
export class UserAddressPayload {
  @Field()
  address: string
  @Field()
  subDistrict: string
  @Field()
  district: string
  @Field()
  province: string
  @Field()
  postcode: string
}

@ObjectType()
export class UserPaginationPayload extends PaginationPayload implements PaginateResult<User> {
  @Field(() => [User])
  docs: User[]
}

@ObjectType()
export class UserPaginationAggregatePayload extends PaginationPayload implements AggregatePaginateResult<User> {
  @Field(() => [User])
  docs: User[]
}

@ObjectType()
export class UserPendingAggregatePayload extends PaginationPayload implements AggregatePaginateResult<UserPending> {
  @Field(() => [UserPending])
  docs: UserPending[]
}
