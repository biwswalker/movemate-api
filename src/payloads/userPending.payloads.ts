import { Field, ID, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { EDriverType, EUpdateUserStatus, EUserType } from '@enums/users'

@ObjectType()
export class UserPendingListPayload {
  @Field(() => ID)
  _id: string

  @Field(() => String, { nullable: true })
  userNumber: string

  @Field(() => String, { nullable: true })
  title: string

  @Field(() => String, { nullable: true })
  fullName: string

  @Field(() => String, { nullable: true })
  email: string

  @Field(() => EUserType, { nullable: true })
  userType: EUserType

  @Field(() => String, { nullable: true })
  contactNumber: string

  @Field(() => EUpdateUserStatus, { nullable: true })
  status: EUpdateUserStatus

  @Field(() => String, { nullable: true })
  approveBy: string

  @Field(() => String, { nullable: true })
  updatedAt: string

  @Field(() => String, { nullable: true })
  businessBranch: string

  @Field(() => String, { nullable: true })
  profileImageName: string

  @Field(() => [EDriverType], { nullable: true })
  driverType: EDriverType[]

  @Field(() => String, { nullable: true })
  lineId: string

  @Field(() => String, { nullable: true })
  serviceVehicleTypeName: string

  @Field(() => String, { nullable: true })
  licensePlateProvince: string

  @Field(() => String, { nullable: true })
  licensePlateNumber: string
}

@ObjectType()
export class UserPendingAggregatePayload
  extends PaginationPayload
  implements AggregatePaginateResult<UserPendingListPayload>
{
  @Field(() => [UserPendingListPayload])
  docs: UserPendingListPayload[]
}
