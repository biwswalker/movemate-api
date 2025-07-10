import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, mongoose, plugin } from '@typegoose/typegoose'
import autopopulate from 'mongoose-autopopulate'
import mongoosePagination from 'mongoose-paginate-v2'
import { File } from './file.model'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import UserModel, { User } from './user.model'
import { EPaymentMethod } from '@enums/payments'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
} from './customerBusinessCreditPayment.model'
import IndividualCustomerModel, { IndividualCustomer } from './customerIndividual.model'
import BusinessCustomerModel, { BusinessCustomer } from './customerBusiness.model'
import DriverDetailModel, { DriverDetail } from './driverDetail.model'
import { ECreditDataStatus, EDriverType, EUpdateUserStatus, EUserRole, EUserType } from '@enums/users'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { get, includes } from 'lodash'
import { ClientSession } from 'mongoose'

@plugin(autopopulate)
@plugin(mongoosePagination)
@plugin(mongooseAggregatePaginate)
@ObjectType()
export class UserPending extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ ref: 'User', autopopulate: true, required: true })
  user: Ref<User>

  @Field(() => ID)
  @Property({ required: true })
  userId: string

  @Field()
  @Property({ required: true })
  userNumber: string

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

  @Field(() => EUpdateUserStatus)
  @Property({ default: false })
  status: EUpdateUserStatus

  @Field(() => User, { nullable: true })
  @Property({ ref: 'User', autopopulate: true })
  approvalBy: Ref<User>

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static paginate: mongoose.PaginateModel<typeof UserPending>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof UserPending>['aggregatePaginate']

  @Field({ nullable: true })
  get fullname(): string {
    const _user = get(this, '_doc.user', undefined) as User | undefined
    const userRole = _user.userRole
    const userType = _user.userType

    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined = get(_user, 'individualDetail', undefined)
        if (individualDetail) {
          const title = get(individualDetail, 'title', '')
          const otherTitle = get(individualDetail, 'otherTitle', '')
          const firstname = get(individualDetail, 'firstname', '')
          const lastname = get(individualDetail, 'lastname', '')
          const titleName = title !== 'อื่นๆ' ? title : otherTitle
          return `${titleName}${firstname} ${lastname}`
        }
        return ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined = get(_user, 'businessDetail', undefined)
        if (businessDetail) {
          return `${businessDetail.businessTitle} ${businessDetail.businessName}`
        }
        return ''
      }
    } else if (userRole === EUserRole.DRIVER) {
      const driverDetail: DriverDetail | undefined = get(_user, 'driverDetail', undefined)
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
    }
    return ''
  }

  @Field({ nullable: true })
  get email(): string {
    const _user = get(this, '_doc.user', undefined) as User | undefined
    const userRole = _user.userRole
    const userType = _user.userType
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined = get(_user, 'individualDetail', undefined)
        return individualDetail ? individualDetail.email : ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined = get(_user, 'businessDetail', undefined)
        return businessDetail ? businessDetail.businessEmail : ''
      }
    }
    return ''
  }

  @Field({ nullable: true })
  get contactNumber(): string {
    const _user = get(this, '_doc.user', undefined) as User | undefined
    const userRole = _user.userRole
    const userType = _user.userType
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const individualDetail: IndividualCustomer | undefined = get(_user, 'individualDetail', undefined)
        return individualDetail ? individualDetail.phoneNumber : ''
      } else if (userType === EUserType.BUSINESS) {
        const businessDetail: BusinessCustomer | undefined = get(_user, 'businessDetail', undefined)
        return businessDetail ? businessDetail.contactNumber : ''
      }
    } else if (userRole === EUserRole.DRIVER) {
      const driverDetail: DriverDetail | undefined = get(_user, 'driverDetail', undefined)
      return driverDetail ? driverDetail.phoneNumber : ''
    }
    return ''
  }

  @Field({ nullable: true })
  get address(): string {
    const _user = get(this, '_doc.user', undefined) as User | undefined
    const userRole = _user.userRole
    const userType = _user.userType
    if (userRole === EUserRole.CUSTOMER) {
      if (userType === EUserType.INDIVIDUAL) {
        const _individualDetail = get(_user, 'individualDetail', '') as IndividualCustomer | undefined
        if (_individualDetail) {
          return `${_individualDetail.address} แขวง/ตำบล ${_individualDetail.subDistrict} เขต/อำเภอ ${_individualDetail.district} จังหวัด ${_individualDetail.province} ${_individualDetail.postcode}`
        }
      } else if (userType === EUserType.BUSINESS) {
        const _businessDetail = get(_user, 'businessDetail', '') as BusinessCustomer | undefined
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

  async copy(session?: ClientSession): Promise<boolean> {
    const _userId = get(this, '_doc.userId', '') || this.userId
    const _profileImage = get(this, '_doc.profileImage', '') || this.profileImage
    const _pendingData = get(this, '_doc') as UserPending

    const user = await UserModel.findById(_userId).session(session)
    if (!user) {
      throw new Error(`ไม่พบผู้ใช้งาน ID: ${_userId} ระหว่างการอัปเดตข้อมูล`)
    }

    // 1. อัปเดตรูปโปรไฟล์ (ถ้ามี)
    if (_profileImage) {
      user.profileImage = _profileImage as any
    }

    // 2. อัปเดตข้อมูลตาม Role
    if (user.userRole === EUserRole.CUSTOMER) {
      if (user.userType === EUserType.BUSINESS && user.businessDetail) {
        const mainBusinessCustomer = await BusinessCustomerModel.findById(user.businessDetail).session(session)

        if (mainBusinessCustomer) {
          const pendingBusinessData = _pendingData.businessDetail as BusinessCustomer
          const {
            creditPayment: pendingCreditPaymentId,
            cashPayment: pendingCashPaymentId,
            ...otherDetails
          } = pendingBusinessData

          // ตรรกะสำหรับอัปเดตข้อมูลการชำระเงิน
          if (otherDetails.paymentMethod === EPaymentMethod.CREDIT && pendingCreditPaymentId) {
            const draftCreditDoc = await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(pendingCreditPaymentId, {
              dataStatus: ECreditDataStatus.ACTIVE,
            }).session(session)
            if (draftCreditDoc) {
              // 1. เปิดใช้งานเอกสารเครดิตฉบับร่าง
              // draftCreditDoc.dataStatus = ECreditDataStatus.ACTIVE
              // await draftCreditDoc.save({ session })

              // 2. ลบข้อมูลเครดิตเก่า (ถ้ามี)
              if (
                mainBusinessCustomer.creditPayment &&
                mainBusinessCustomer.creditPayment.toString() !== draftCreditDoc._id.toString()
              ) {
                await BusinessCustomerCreditPaymentModel.findByIdAndDelete(mainBusinessCustomer.creditPayment).session(
                  session,
                )
              }
              // 3. ผูกข้อมูลเครดิตใหม่กับลูกค้า
              mainBusinessCustomer.creditPayment = draftCreditDoc._id as any
              mainBusinessCustomer.cashPayment = undefined // ล้างข้อมูล cash ถ้าเปลี่ยนมาเป็น credit
            }
          } else if (otherDetails.paymentMethod === EPaymentMethod.CASH) {
            // ถ้าเปลี่ยนเป็นจ่ายเงินสด ให้ล้างข้อมูลเครดิตเก่า
            if (mainBusinessCustomer.creditPayment) {
              await BusinessCustomerCreditPaymentModel.findByIdAndDelete(mainBusinessCustomer.creditPayment).session(
                session,
              )
              mainBusinessCustomer.creditPayment = undefined
            }
          }

          // 4. อัปเดตข้อมูลอื่นๆ ของ BusinessCustomer
          Object.assign(mainBusinessCustomer, otherDetails)
          await BusinessCustomerModel.findByIdAndUpdate(mainBusinessCustomer.id, mainBusinessCustomer, { session })
        }
      } else if (user.userType === EUserType.INDIVIDUAL && user.individualDetail) {
        const pendingIndividualData = _pendingData.individualDetail
        await IndividualCustomerModel.findByIdAndUpdate(user.individualDetail, pendingIndividualData, { session })
      }
    } else if (user.userRole === EUserRole.DRIVER) {
      if (user.driverDetail) {
        const pendingDriverData = _pendingData.driverDetail
        await DriverDetailModel.findByIdAndUpdate(user.driverDetail, pendingDriverData, { session })
      }
    }

    // บันทึกการเปลี่ยนแปลงใน User model
    await user.save({ session })
    return true
  }
}

const UserPendingModel = getModelForClass(UserPending)

export default UserPendingModel
