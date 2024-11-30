import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsNotEmpty, IsString, Length } from 'class-validator'
import { VehicleType } from './vehicleType.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { DriverDocument } from './driverDocument.model'
import { get, includes } from 'lodash'
import TransactionModel from './transaction.model'
import { EDriverType } from '@enums/users'
import { User } from './user.model'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class DriverDetail {
  @Field(() => ID)
  readonly _id: string

  @Field(() => [EDriverType])
  @Property({ allowMixed: Severity.ALLOW })
  driverType: EDriverType[]

  @Field()
  @IsString()
  @Property()
  title: string

  @Field()
  @IsString()
  @Property()
  otherTitle: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  firstname: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  lastname: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  businessName: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  businessBranch?: string

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(13)
  @Property({ required: true })
  taxNumber: string

  @Field()
  @Property()
  phoneNumber: string

  @Field()
  @Property()
  lineId: string

  @Field()
  @IsString()
  @Property()
  address: string

  @Field()
  @Property()
  province: string

  @Field()
  @IsString()
  @Property()
  district: string

  @Field()
  @IsString()
  @Property()
  subDistrict: string

  @Field()
  @IsString()
  @Property()
  postcode: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  bank: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  bankBranch: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  bankName: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  bankNumber: string

  @Field(() => [VehicleType], { defaultValue: [], nullable: true })
  @Property({ autopopulate: true, ref: 'VehicleType', default: [] })
  serviceVehicleTypes: Ref<VehicleType>[]

  @Field({ defaultValue: 0 })
  @Property({ default: 0 })
  balance: number

  @Field(() => DriverDocument)
  @Property({ autopopulate: true, ref: 'DriverDocument' })
  documents: Ref<DriverDocument>

  // @Field(() => [User], { nullable: true })
  // @Property({ autopopulate: true, ref: 'User' })
  // employees: Ref<User>[]

  @Field({ nullable: true })
  get fullname(): string {
    const driverType = get(this, '_doc.driverType', '') || this.driverType
    const title = get(this, '_doc.title', '') || this.title
    const otherTitle = get(this, '_doc.otherTitle', '') || this.otherTitle
    if (includes(driverType, EDriverType.BUSINESS)) {
      const businessName = get(this, '_doc.businessName', '') || this.businessName
      return `${title === 'อื่นๆ' ? otherTitle : title}${businessName}`
    } else {
      const firstname = get(this, '_doc.firstname', '') || this.firstname
      const lastname = get(this, '_doc.lastname', '') || this.lastname
      return `${title === 'อื่นๆ' ? otherTitle : title}${firstname} ${lastname}`
    }

    // const driverDetail: DriverDetail | undefined =
    //   get(this, '_doc.driverDetail', undefined) || this.driverDetail || undefined
    // if (driverDetail) {
    //   if (!driverDetail.fullname) {
    //     const driverTypes = driverDetail.driverType
    //     const title = driverDetail.title
    //     const otherTitle = driverDetail.otherTitle
    //     const titleName = `${title === 'อื่นๆ' ? otherTitle : title}`
    //     if (includes(driverTypes, EDriverType.BUSINESS)) {
    //       const businessName = driverDetail.businessName
    //       return `${titleName}${businessName}`
    //     } else {
    //       const firstname = driverDetail.firstname
    //       const lastname = driverDetail.lastname
    //       return `${titleName}${firstname} ${lastname}`
    //     }
    //   }
    //   return driverDetail.fullname
    // }
  }

  async updateBalance() {
    const transactions = await TransactionModel.calculateTransaction(this._id)
    console.log('New user balance: ', this._id, transactions.totalPending)
    await DriverDetailModel.findByIdAndUpdate(this._id, { balance: transactions.totalPending })
  }
}

const DriverDetailModel = getModelForClass(DriverDetail)

export default DriverDetailModel
