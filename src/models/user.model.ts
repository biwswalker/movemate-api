import { ObjectType, Field, ID, Int } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass, plugin } from '@typegoose/typegoose'
import autopopulate from 'mongoose-autopopulate'
import { IsNotEmpty, IsString, IsEnum } from 'class-validator'
import bcrypt from 'bcrypt'
import mongoosePagination from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongoose, { ProjectionType, QueryOptions } from 'mongoose'
import { Admin } from './admin.model'
import { IndividualCustomer } from './customerIndividual.model'
import { BusinessCustomer } from './customerBusiness.model'
import { File } from './file.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { decryption } from '@utils/encryption'
import { find, get, includes, isEmpty } from 'lodash'
import { EXISTING_BUSINESS_NAME, EXISTING_PHONENUMBER, EXISTING_TAXID, EXISTING_USERS, GET_CUSTOMER_BY_EMAIL } from '@pipelines/user.pipeline'
import { Notification } from './notification.model'
import { DriverDetail } from './driverDetail.model'
import {
  EDriverStatus,
  EDriverType,
  ERegistration,
  EUserRole,
  EUserStatus,
  EUserType,
  EUserValidationStatus,
} from '@enums/users'
import { EPaymentMethod } from '@enums/payments'
import { BusinessCustomerCreditPayment } from './customerBusinessCreditPayment.model'
import { UserAddressPayload } from '@payloads/user.payloads'

@plugin(autopopulate)
@plugin(mongoosePagination)
@plugin(aggregatePaginate)
@ObjectType()
export class User extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @IsString()
  @IsNotEmpty()
  @Property({ required: true })
  userNumber: string

  @Field(() => EUserRole)
  @IsEnum(EUserRole)
  @IsNotEmpty()
  @Property({ enum: EUserRole, default: EUserRole.CUSTOMER, required: true })
  userRole: EUserRole

  @Field(() => EUserType)
  @IsEnum(EUserType)
  @IsNotEmpty()
  @Property({ enum: EUserType, default: EUserType.INDIVIDUAL, required: true })
  userType: EUserType

  @Field()
  @Property({ required: true, unique: true })
  username: string

  @Property({ required: true })
  password: string

  @Field({ nullable: true })
  @Property()
  remark: string

  @Field(() => EUserStatus)
  @IsEnum(EUserStatus)
  @IsNotEmpty()
  @Property({ required: true, enum: EUserStatus, default: EUserStatus.ACTIVE })
  status: EUserStatus

  @Field(() => EUserValidationStatus)
  @IsEnum(EUserValidationStatus)
  @IsNotEmpty()
  @Property({
    required: true,
    enum: EUserValidationStatus,
    default: EUserValidationStatus.PENDING,
  })
  validationStatus: EUserValidationStatus

  @Field(() => ERegistration)
  @IsEnum(ERegistration)
  @IsNotEmpty()
  @Property({ required: true, enum: ERegistration, default: ERegistration.WEB })
  registration: ERegistration

  @Field({ nullable: true })
  @Property()
  lastestOTP: string

  @Field({ nullable: true })
  @Property()
  lastestOTPRef: string

  @Field({ nullable: true })
  @Property()
  lastestOTPTime: Date

  @Field()
  @Property()
  isVerifiedEmail: boolean

  @Field()
  @Property()
  isVerifiedPhoneNumber: boolean

  @Field((type) => Int, { nullable: true })
  @Property()
  acceptPolicyVersion: number

  @Field({ nullable: true })
  @Property()
  acceptPolicyTime: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => Admin, { nullable: true })
  @Property({ autopopulate: true, ref: 'Admin' })
  adminDetail?: Ref<Admin>

  @Field(() => IndividualCustomer, { nullable: true })
  @Property({ autopopulate: true, ref: 'IndividualCustomer' })
  individualDetail?: Ref<IndividualCustomer>

  @Field(() => BusinessCustomer, { nullable: true })
  @Property({ autopopulate: true, ref: 'BusinessCustomer' })
  businessDetail?: Ref<BusinessCustomer>

  @Field(() => DriverDetail, { nullable: true })
  @Property({ autopopulate: true, ref: 'DriverDetail' })
  driverDetail?: Ref<DriverDetail>

  // @Field(() => [User], { nullable: true })
  // @Property({ autopopulate: true, ref: 'User' })
  // agents?: Ref<User>[]

  @Field(() => File, { nullable: true })
  @Property({ autopopulate: true, ref: 'File' })
  profileImage?: Ref<File>

  @Field(() => BusinessCustomer, { nullable: true })
  @Property({ autopopulate: true, ref: 'BusinessCustomer' })
  upgradeRequest?: Ref<BusinessCustomer>

  @Property({ required: false, default: true })
  isChangePasswordRequire: boolean

  @Property()
  lastestResetPassword?: Date

  @Property()
  resetPasswordCode?: string

  @Field(() => [Notification], { nullable: true })
  @Property({ ref: () => Notification, default: [], autopopulate: true })
  notifications: Ref<Notification>[]

  @Field(() => String, { nullable: true, defaultValue: '' })
  @Property({ default: '' })
  fcmToken?: string

  @Field(() => EDriverStatus, { nullable: true })
  @Property({ default: EDriverStatus.IDLE, required: false })
  drivingStatus?: EDriverStatus

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @Property({ default: [], allowMixed: Severity.ALLOW })
  favoriteDrivers?: string[]

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @Property({ default: [], allowMixed: Severity.ALLOW })
  parents?: string[]

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @Property({ default: [], allowMixed: Severity.ALLOW })
  requestedParents?: string[]

  @Field({ nullable: true })
  @Property({ required: false, default: '' })
  validationRejectedMessage?: string

  @Field(() => User, { nullable: true })
  @Property({ required: false, autopopulate: true, ref: 'User' })
  validationBy?: Ref<User>

  @Field({ nullable: true })
  get fullname(): string {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''

    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined =
          get(this, '_doc.individualDetail', undefined) || this.individualDetail || undefined
        if (individualDetail) {
          const title = get(individualDetail, 'title', '')
          const otherTitle = get(individualDetail, 'otherTitle', '')
          const firstname = get(individualDetail, 'firstname', '')
          const lastname = get(individualDetail, 'lastname', '')

          const INDIVIDUAL_TITLE_NAME_OPTIONS = [
            { value: 'Miss', label: 'นางสาว' },
            { value: 'Mrs.', label: 'นาง' },
            { value: 'Mr.', label: 'นาย' },
            { value: 'other', label: 'อื่นๆ' },
          ]
          const titleName = title !== 'other' ? find(INDIVIDUAL_TITLE_NAME_OPTIONS, ['value', title]).label : otherTitle

          return `${titleName}${firstname} ${lastname}`
        }
        return ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined =
          get(this, '_doc.businessDetail', undefined) || this.businessDetail || undefined
        if (businessDetail) {
          const BUSINESS_TITLE_NAME_OPTIONS = [
            { value: 'Co', label: 'บจก.' },
            { value: 'Part', label: 'หจก.' },
            { value: 'Pub', label: 'บมจ.' },
          ]
          const title = find(BUSINESS_TITLE_NAME_OPTIONS, ['value', businessDetail.businessTitle]).label
          return `${title} ${businessDetail.businessName}`
        }
        return ''
      }
    } else if (userRole === EUserRole.DRIVER) {
      const driverDetail: DriverDetail | undefined =
        get(this, '_doc.driverDetail', undefined) || this.driverDetail || undefined
      if (driverDetail) {
        if (!driverDetail.fullname) {
          const driverTypes = driverDetail.driverType
          const title = driverDetail.title
          const otherTitle = driverDetail.otherTitle
          const titleName = `${title === 'อื่นๆ' ? otherTitle : title}`
          if (includes(driverTypes, EDriverType.BUSINESS)) {
            const businessName = driverDetail.businessName
            return `${titleName}${businessName}`
          } else {
            const firstname = driverDetail.firstname
            const lastname = driverDetail.lastname
            return `${titleName}${firstname} ${lastname}`
          }
        }
        return driverDetail.fullname
      }
    } else if (userRole === EUserRole.ADMIN) {
      const admin: Admin | undefined = get(this, '_doc.adminDetail', undefined) || this.adminDetail || undefined
      if (admin) {
        if (!admin.fullname) {
          const title = admin.title || ''
          const otherTitle = ''
          const titleName = `${title === 'อื่นๆ' ? otherTitle : title}`
          const firstname = admin.firstname
          const lastname = admin.lastname
          return `${titleName || ''}${firstname} ${lastname}`
        }
        return admin.fullname
      }
    }
    return ''
  }

  @Field({ nullable: true })
  get taxId(): string {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''

    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined =
          get(this, '_doc.individualDetail', undefined) || this.individualDetail || undefined
        if (individualDetail) {
          const taxId = get(individualDetail, 'taxId', '')
          return taxId
        }
        return ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined =
          get(this, '_doc.businessDetail', undefined) || this.businessDetail || undefined
        if (businessDetail) {
          const taxId = get(businessDetail, 'taxNumber', '')
          return taxId
        }
        return ''
      }
    } else if (userRole === EUserRole.DRIVER) {
      const driverDetail: DriverDetail | undefined =
        get(this, '_doc.driverDetail', undefined) || this.driverDetail || undefined
      if (driverDetail) {
        return driverDetail.taxNumber ?? ''
      }
    } else if (userRole === EUserRole.ADMIN) {
      const admin: Admin | undefined = get(this, '_doc.adminDetail', undefined) || this.adminDetail || undefined
      if (admin) {
        return admin.taxId ?? ''
      }
    }
    return ''
  }

  @Field({ nullable: true })
  get email(): string {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined =
          get(this, '_doc.individualDetail', undefined) || this.individualDetail || undefined
        return individualDetail ? individualDetail.email : ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined =
          get(this, '_doc.businessDetail', undefined) || this.businessDetail || undefined
        return businessDetail ? businessDetail.businessEmail : ''
      }
    } else if (userRole === EUserRole.ADMIN) {
      const adminDetail: Admin | undefined =
        get(this, '_doc.adminDetail', undefined) || this.adminDetail || undefined
      return adminDetail ? adminDetail.email : ''
    }
    return ''
  }

  @Field({ nullable: true })
  get contactNumber(): string {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined =
          get(this, '_doc.individualDetail', undefined) || this.individualDetail || undefined
        return individualDetail ? individualDetail.phoneNumber : ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined =
          get(this, '_doc.businessDetail', undefined) || this.businessDetail || undefined
        return businessDetail ? businessDetail.contactNumber : ''
      }
    } else if (userRole === EUserRole.DRIVER) {
      const driverDetail: DriverDetail | undefined =
        get(this, '_doc.driverDetail', undefined) || this.driverDetail || undefined
      return driverDetail ? driverDetail.phoneNumber : ''
    }
    return ''
  }

  @Field({ nullable: true })
  get address(): string {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const _individualDetail = (get(this, '_doc.individualDetail', '') || this.individualDetail) as
          | IndividualCustomer
          | undefined
        if (_individualDetail) {
          return `${_individualDetail.address} แขวง/ตำบล ${_individualDetail.subDistrict} เขต/อำเภอ ${_individualDetail.district} จังหวัด ${_individualDetail.province} ${_individualDetail.postcode}`
        }
      } else if (userType === EUserType.BUSINESS) {
        const _businessDetail = (get(this, '_doc.businessDetail', '') || this.businessDetail) as
          | BusinessCustomer
          | undefined
        if (_businessDetail) {
          if (_businessDetail.paymentMethod === EPaymentMethod.CREDIT) {
            const creditPayment = _businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
            return `${creditPayment.financialAddress} แขวง/ตำบล ${creditPayment.financialSubDistrict} เขต/อำเภอ ${creditPayment.financialDistrict} จังหวัด ${creditPayment.financialProvince} ${creditPayment.financialPostcode}`
          } else {
            return `${_businessDetail.address} แขวง/ตำบล ${_businessDetail.subDistrict} เขต/อำเภอ ${_businessDetail.district} จังหวัด ${_businessDetail.province} ${_businessDetail.postcode}`
          }
        }
      }
    }
    return ''
  }

  @Field({ nullable: true })
  get addressData(): UserAddressPayload {
    const userRole = get(this, '_doc.userRole', '') || this.userRole || ''
    const userType = get(this, '_doc.userType', '') || this.userType || ''
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const _individualDetail = (get(this, '_doc.individualDetail', '') || this.individualDetail) as
          | IndividualCustomer
          | undefined
        if (_individualDetail) {
          return {
            address: _individualDetail.address,
            subDistrict: _individualDetail.subDistrict,
            district: _individualDetail.district,
            province: _individualDetail.province,
            postcode: _individualDetail.postcode,
          }
        }
      } else if (userType === EUserType.BUSINESS) {
        const _businessDetail = (get(this, '_doc.businessDetail', '') || this.businessDetail) as
          | BusinessCustomer
          | undefined
        if (_businessDetail) {
          if (_businessDetail.paymentMethod === EPaymentMethod.CREDIT) {
            const creditPayment = _businessDetail.creditPayment as BusinessCustomerCreditPayment | undefined
            return {
              address: creditPayment.financialAddress,
              subDistrict: creditPayment.financialSubDistrict,
              district: creditPayment.financialDistrict,
              province: creditPayment.financialProvince,
              postcode: creditPayment.financialPostcode,
            }
          } else {
            return {
              address: _businessDetail.address,
              subDistrict: _businessDetail.subDistrict,
              district: _businessDetail.district,
              province: _businessDetail.province,
              postcode: _businessDetail.postcode,
            }
          }
        }
      }
    }
    return {
      address: '',
      subDistrict: '',
      district: '',
      province: '',
      postcode: '',
    }
  }

  static paginate: mongoose.PaginateModel<typeof User>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof User>['aggregatePaginate']

  async validatePassword(password: string): Promise<boolean> {
    const password_decryption = decryption(password)
    return bcrypt.compare(password_decryption, this.password)
  }

  static async findByUsername(
    username: string,
    projection?: ProjectionType<User> | null,
    options?: QueryOptions<User> | null,
  ): Promise<User | null> {
    return UserModel.findOne({ username }, projection, options)
  }

  static async findCustomerByEmail(email: string): Promise<User | null> {
    const user = await UserModel.aggregate(GET_CUSTOMER_BY_EMAIL(email))
    return user.length > 0 ? user[0] : null
  }

  static async existingEmail(_id: string, email: string, userType: EUserType, userRole: EUserRole): Promise<boolean> {
    const exiting = await UserModel.aggregate(EXISTING_USERS(_id, email, userType, userRole))
    return !isEmpty(exiting)
  }

  static async existingPhonenumber(phoneNumber: string, id?: string): Promise<boolean> {
    const exiting = await UserModel.aggregate(EXISTING_PHONENUMBER(phoneNumber, id))
    return !isEmpty(exiting)
  }

  static async existingTaxId(taxId: string, id?: string): Promise<boolean> {
    const exiting = await UserModel.aggregate(EXISTING_TAXID(taxId, id))
    return !isEmpty(exiting)
  }

  static async existingBusinessName(businessName: string, id?: string): Promise<boolean> {
    const exiting = await UserModel.aggregate(EXISTING_BUSINESS_NAME(businessName, id))
    return !isEmpty(exiting)
  }

  async getFavoriteDrivers(): Promise<User[]> {
    if (!isEmpty(this.favoriteDrivers)) {
      const favoritDrivers = await UserModel.find({ _id: { $in: this.favoriteDrivers } }).exec()
      return favoritDrivers
    }
    return []
  }
}

const UserModel = getModelForClass(User)

export default UserModel
