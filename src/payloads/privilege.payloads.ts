import { Privilege } from '@models/privilege.model'
import { Field, ID, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { PaginateResult } from 'mongoose'
import { EPrivilegeDiscountUnit } from '@enums/privilege'

@ObjectType()
export class PrivilegePaginationPayload extends PaginationPayload implements PaginateResult<Privilege> {
  @Field(() => [Privilege])
  docs: Privilege[]
}

@ObjectType()
export class SearchPrivilegeResultPayload {
  @Field(() => ID)
  _id: string

  @Field()
  name: string

  @Field()
  code: string

  @Field()
  discount: number

  @Field(() => EPrivilegeDiscountUnit)
  unit: EPrivilegeDiscountUnit

  @Field(() => Boolean)
  expired: boolean

  @Field(() => Boolean)
  used: boolean

  @Field(() => Boolean)
  limitReached: boolean

  @Field({ nullable: true })
  description: string
}
