import { Field, ID, Int, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from 'class-validator'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongoose from 'mongoose'
import mongoosePagination from 'mongoose-paginate-v2'
import { User } from './user.model'
import { EPrivilegeDiscountUnit, EPrivilegeStatus } from '@enums/privilege'
import { get, min } from 'lodash'

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

  @Field(() => Int, { nullable: true })
  @Property()
  limitAmout: number

  @Field(() => Int, { nullable: true, description: 'จำนวนครั้งที่จำกัดให้ User 1 คนสามารถใช้ได้ (0 คือไม่จำกัด)' })
  @Property({ default: 0 })
  limitPerUser?: number // <-- จำนวนครั้งที่จำกัดสำหรับ 1 User

  @Field(() => Int, { defaultValue: 0 })
  get usedAmout(): number {
    const userRoles = get(this, '_doc.usedUser', []) || this.usedUser || []
    return userRoles.length
  }

  static async calculateDiscount(
    discountId: string,
    subTotalPrice: number,
  ): Promise<{ discount: Privilege | undefined; totalDiscount: number; discountName: string }> {
    if (!discountId || !subTotalPrice) {
      return { totalDiscount: 0, discountName: '', discount: undefined }
    }
    const privilege = await PrivilegeModel.findById(discountId)
    if (!privilege) {
      return { totalDiscount: 0, discountName: '', discount: undefined }
    }

    let discountName = ''
    let totalDiscount = 0

    const { name, unit } = privilege
    const _discount = (privilege.discount || 0) as number
    const _minPrice = (privilege.minPrice || 0) as number
    const isPercent = unit === EPrivilegeDiscountUnit.PERCENTAGE
    if (subTotalPrice >= _minPrice) {
      const _maxDiscountPrice = (privilege.maxDiscountPrice || 0) as number
      if (isPercent) {
        const discountAsBath = (_discount / 100) * subTotalPrice
        const maxDiscountAsBath = _maxDiscountPrice ? min([_maxDiscountPrice, discountAsBath]) : discountAsBath
        totalDiscount = maxDiscountAsBath
      } else {
        const maxDiscountAsBath = min([subTotalPrice, _discount])
        totalDiscount = maxDiscountAsBath
      }
    } else {
      totalDiscount = 0
    }
    discountName = `${name} (${_discount}${
      unit === EPrivilegeDiscountUnit.CURRENCY ? ' บาท' : unit === EPrivilegeDiscountUnit.PERCENTAGE ? '%' : ''
    })`
    return { discount: privilege, totalDiscount, discountName }
  }

  static paginate: mongoose.PaginateModel<typeof Privilege>['paginate']
}

const PrivilegeModel = getModelForClass(Privilege)

export default PrivilegeModel
