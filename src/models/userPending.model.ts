import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Ref, Severity, plugin } from '@typegoose/typegoose'
import autopopulate from 'mongoose-autopopulate'
import { IsNotEmpty, IsString, IsEnum, IsEmail, Length } from 'class-validator'
import mongoosePagination from 'mongoose-paginate-v2'
import { File } from './file.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import UserModel from './user.model'
import { EPaymentMethod } from '@enums/payments'
import BusinessCustomerCreditPaymentModel, { BilledMonth, EBilledType } from './customerBusinessCreditPayment.model'
import { DriverDocument } from './driverDocument.model'
import { VehicleType } from './vehicleType.model'
import IndividualCustomerModel from './customerIndividual.model'
import BusinessCustomerModel from './customerBusiness.model'
import BusinessCustomerCashPaymentModel from './customerBusinessCashPayment.model'
import DriverDetailModel from './driverDetail.model'
import { EUserRole, EUserType } from '@enums/users'

@plugin(autopopulate)
@plugin(mongoosePagination)
@ObjectType()
export class UserPending extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => ID)
  @Property({ required: true })
  userId: string

  @Field()
  @Property({ default: false })
  isApproved: boolean

  @Field(() => File, { nullable: true })
  @Property({ autopopulate: true, ref: 'File' })
  profileImage?: Ref<File>

  @Field(() => IndividualCustomer, { nullable: true })
  @Property()
  individualDetail?: IndividualCustomer

  @Field(() => BusinessCustomer, { nullable: true })
  @Property()
  businessDetail?: BusinessCustomer

  @Field(() => DriverDetail, { nullable: true })
  @Property()
  driverDetail?: DriverDetail

  async copy(): Promise<boolean> {
    /**
     * TODO:
     * Add approved admin user
     */
    const userModel = await UserModel.findById(this.userId).lean()
    if (this.profileImage) {
      await UserModel.findByIdAndUpdate(userModel._id, { profileImage: this.profileImage })
    }
    if (userModel.userRole === EUserRole.CUSTOMER) {
      if (userModel.userType === EUserType.INDIVIDUAL && userModel.individualDetail) {
        const individualCustomerModel = await IndividualCustomerModel.findById(userModel.individualDetail).lean()
        if (individualCustomerModel) {
          await IndividualCustomerModel.findByIdAndUpdate(individualCustomerModel._id, this.individualDetail)
        }
      } else if (userModel.userType === EUserType.BUSINESS) {
        const businessCustomerModel = await BusinessCustomerModel.findById(userModel.businessDetail).lean()
        if (businessCustomerModel) {
          const { changePaymentMethodRequest, creditPayment, ...detail } = this.businessDetail
          let creditId = null
          let cashId = null
          if (detail.paymentMethod === EPaymentMethod.CREDIT) {
            // Update Credit
            if (businessCustomerModel.creditPayment) {
              const creditModel = await BusinessCustomerCreditPaymentModel.findById(
                businessCustomerModel.creditPayment,
              ).lean()
              await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(creditModel._id, creditPayment)
            } else {
              const newCreditModel = new BusinessCustomerCreditPaymentModel(creditPayment)
              await newCreditModel.save()
              creditId = newCreditModel._id
            }
          } else if (detail.paymentMethod === EPaymentMethod.CASH) {
            // Update Cash
            if (!businessCustomerModel.cashPayment) {
              const newCashModel = new BusinessCustomerCashPaymentModel({ acceptedEReceiptDate: new Date() })
              await newCashModel.save()
              cashId = newCashModel._id
            }
          }
          await BusinessCustomerModel.findByIdAndUpdate(businessCustomerModel._id, {
            ...detail,
            changePaymentMethodRequest: false,
            ...(creditId ? { creditPayment: creditId } : {}),
            ...(cashId ? { cashPayment: cashId } : {}),
          })
        }
      }
    } else if (userModel.userRole === EUserRole.DRIVER) {
      if (userModel.driverDetail) {
        const driverDetail = await DriverDetailModel.findById(userModel.driverDetail).lean()
        if (driverDetail) {
          await DriverDetailModel.findByIdAndUpdate(driverDetail._id, this.driverDetail)
        }
      }
    }

    return true
  }
}

@ObjectType()
class IndividualCustomer {
  @Field()
  @IsEmail()
  @IsNotEmpty()
  @Property({ required: true })
  email: string

  @Field()
  @IsString()
  @Property({ required: true })
  title: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  otherTitle: string

  @Field()
  @IsString()
  @Property({ required: true })
  firstname: string

  @Field()
  @IsString()
  @Property({ required: true })
  lastname: string

  @Field()
  @Property({ required: true })
  phoneNumber: string

  @Field({ nullable: true })
  @IsString()
  @Length(13)
  @Property()
  taxId: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  address: string

  @Field({ nullable: true })
  @Property()
  province: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  district: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  subDistrict: string

  @Field({ nullable: true })
  @IsString()
  @Property()
  postcode: string
}

@ObjectType()
class BusinessCustomer {
  @Field()
  @Property({ enum: ['Co', 'Part', 'Pub', 'other'], required: true })
  businessTitle: string

  @Field()
  @Property({ required: true })
  businessName: string

  @Field({ nullable: true })
  @Property()
  businessBranch?: string

  @Field()
  @Property({ required: true })
  businessType: string

  @Field({ nullable: true })
  @Property()
  businessTypeOther: string

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(13)
  @Property({ required: true })
  taxNumber: string

  @Field()
  @IsString()
  @Property({ required: true })
  address: string

  @Field()
  @Property({ required: true })
  province: string

  @Field()
  @IsString()
  @Property({ required: true })
  district: string

  @Field()
  @IsString()
  @Property({ required: true })
  subDistrict: string

  @Field()
  @IsString()
  @Property({ required: true })
  postcode: string

  @Field()
  @Property({ required: true })
  contactNumber: string

  @Field()
  @IsEmail()
  @Property({ required: true })
  businessEmail: string

  @Field(() => EPaymentMethod)
  @Property({ required: true })
  paymentMethod: EPaymentMethod

  @Field(() => CustomerCreditPayment, { nullable: true })
  @Property()
  creditPayment?: CustomerCreditPayment

  @Field({ nullable: true })
  @Property({ default: false })
  changePaymentMethodRequest?: boolean
}

@ObjectType()
class CustomerCreditPayment {
  @Field(() => ID)
  readonly _id: string

  // Credit
  @Field({ nullable: true })
  @Property({ default: false })
  isSameAddress: boolean

  @Field()
  @Property({ required: true })
  financialFirstname: string

  @Field()
  @Property({ required: true })
  financialLastname: string

  @Field()
  @Property({ required: true })
  financialContactNumber: string

  @Field(() => [String])
  @Property({ required: true, allowMixed: Severity.ALLOW })
  financialContactEmails: string[]

  @Field()
  @Property({ required: true })
  financialAddress: string

  @Field()
  @Property({ required: true })
  financialPostcode: string

  @Field()
  @Property({ required: true })
  financialProvince: string

  @Field()
  @Property({ required: true })
  financialDistrict: string

  @Field()
  @Property({ required: true })
  financialSubDistrict: string

  @Field()
  @IsEnum(EBilledType)
  @IsNotEmpty()
  @Property({ enum: EBilledType, default: EBilledType.DEFAULT, required: true })
  billedDateType: EBilledType

  @Field((type) => BilledMonth)
  @Property({ required: true })
  billedDate: BilledMonth

  @Field()
  @IsEnum(EBilledType)
  @IsNotEmpty()
  @Property({ enum: EBilledType, default: EBilledType.DEFAULT, required: true })
  billedRoundType: EBilledType

  @Field((type) => BilledMonth)
  @Property({ required: true })
  billedRound: BilledMonth

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  businessRegistrationCertificateFile: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyIDAuthorizedSignatoryFile: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  certificateValueAddedTaxRegistrationFile: Ref<File>
}

class DriverDetail {
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

  @Field()
  @IsString()
  @Property()
  bank: string

  @Field()
  @IsString()
  @Property()
  bankBranch: string

  @Field()
  @IsString()
  @Property()
  bankName: string

  @Field()
  @IsString()
  @Property()
  bankNumber: string

  @Field(() => [VehicleType])
  @Property({ autopopulate: true, ref: 'VehicleType' })
  serviceVehicleTypes: Ref<VehicleType>[]

  @Field(() => DriverDocument)
  @Property({ autopopulate: true, ref: 'DriverDocument' })
  documents: Ref<DriverDocument>
}
