import { ArgsType, Field, Float, InputType } from 'type-graphql'

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

@ArgsType()
export class GetPrivilegesArgs {
  @Field({ nullable: true })
  _id?: string;

  @Field({ nullable: true })
  status?: TPrivilegeStatus;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  code?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;
}