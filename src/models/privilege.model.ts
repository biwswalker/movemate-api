import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from 'class-validator'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose from 'mongoose'
import mongoosePagination from 'mongoose-paginate-v2'
import { User } from './user.model'

enum EPrivilegeDiscountUnit {
  PERCENTAGE = 'percentage',
  CURRENCY = 'currency',
}

enum EPrivilegeStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
}

@plugin(mongoosePagination)
@ObjectType()
export class Privilege extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @IsEnum(EPrivilegeStatus)
  @Property({ enum: EPrivilegeStatus, default: EPrivilegeStatus.ACTIVE })
  status: TPrivilegeStatus

  @Field()
  @Property({ required: true, unique: true })
  name: string

  @Field()
  @Property({ required: true, unique: true })
  code: string

  @Field({ nullable: true })
  @Property({ required: false })
  startDate: Date

  @Field({ nullable: true })
  @Property({ required: false })
  endDate: Date

  @Field()
  @Property({ required: true })
  discount: number

  @Field()
  @IsEnum(EPrivilegeDiscountUnit)
  @Property({ enum: EPrivilegeDiscountUnit, required: true })
  unit: TPrivilegeDiscountUnit

  @Field({ nullable: true })
  @Property()
  minPrice: number

  @Field({ nullable: true })
  @Property()
  maxDiscountPrice: number

  @Field()
  @Property({ default: true })
  isInfinity: boolean

  @Field()
  @Property({ default: 0, required: false })
  usedAmout: number

  @Field({ nullable: true })
  @Property()
  limitAmout: number

  @Field({ nullable: true })
  @Property()
  description: string

  @Field(() => [User], { defaultValue: [] })
  @Property({ ref: () => User, required: true, default: [] })
  usedUser: Ref<User>[]

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static paginate: mongoose.PaginateModel<typeof Privilege>['paginate']
}

const PrivilegeModel = getModelForClass(Privilege)

export default PrivilegeModel
