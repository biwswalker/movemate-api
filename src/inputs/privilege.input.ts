import { Field, Float, InputType } from 'type-graphql'

@InputType()
export class PrivilegeInput {
  @Field()
  status: TPrivilegeStatus

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

  @Field()
  unit: TPrivilegeDiscountUnit

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
}
