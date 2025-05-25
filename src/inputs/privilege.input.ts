import { EPrivilegeDiscountUnit, EPrivilegeStatus, EPrivilegeStatusCriteria } from '@enums/privilege'
import { ArgsType, Field, Float, InputType } from 'type-graphql'

@InputType()
export class PrivilegeInput {
  @Field(() => EPrivilegeStatus)
  status: EPrivilegeStatus

  @Field()
  name: string

  @Field()
  code: string

  @Field({ nullable: true })
  startDate: Date

  @Field({ nullable: true })
  endDate: Date

  @Field(() => Float)
  discount: number

  @Field(() => EPrivilegeDiscountUnit)
  unit: EPrivilegeDiscountUnit

  @Field(() => Float, { nullable: true })
  minPrice: number

  @Field(() => Float, { nullable: true })
  maxDiscountPrice: number

  @Field({ nullable: true })
  isInfinity: boolean

  @Field({ nullable: true })
  limitAmout: number

  @Field()
  description: string

  @Field({ nullable: true, defaultValue: false })
  defaultShow: boolean
}

@ArgsType()
export class GetPrivilegesArgs {
  @Field({ nullable: true })
  _id?: string

  @Field(() => EPrivilegeStatusCriteria, { nullable: true })
  status?: EPrivilegeStatusCriteria

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  code?: string

  @Field({ nullable: true })
  startDate?: Date

  @Field({ nullable: true })
  endDate?: Date
}
