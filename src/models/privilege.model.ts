import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from 'class-validator'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose from 'mongoose'
import mongoosePagination from 'mongoose-paginate-v2'
import { User } from './user.model'
import { EPrivilegeDiscountUnit, EPrivilegeStatus } from '@enums/privilege'

@plugin(mongoosePagination)
@ObjectType()
export class Privilege extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => EPrivilegeStatus)
  @IsEnum(EPrivilegeStatus)
  @Property({ enum: EPrivilegeStatus, default: EPrivilegeStatus.ACTIVE })
  status: EPrivilegeStatus

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

  @Field(() => EPrivilegeDiscountUnit)
  @IsEnum(EPrivilegeDiscountUnit)
  @Property({ enum: EPrivilegeDiscountUnit, required: true })
  unit: EPrivilegeDiscountUnit

  @Field({ nullable: true })
  @Property()
  minPrice: number

  @Field({ nullable: true })
  @Property()
  maxDiscountPrice: number

  @Field()
  @Property({ default: true })
  isInfinity: boolean

  @Field({ defaultValue: 0, nullable: true })
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

  @Field({ nullable: true, defaultValue: false })
  @Property({ default: false })
  defaultShow?: boolean

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
