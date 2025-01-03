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
import BusinessCustomerCashPaymentModel from './customerBusinessCashPayment.model'
import DriverDetailModel, { DriverDetail } from './driverDetail.model'
import { EUpdateUserStatus, EUserRole, EUserType } from '@enums/users'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { get } from 'lodash'

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

  async copy(): Promise<boolean> {
    /**
     * TODO:
     * Add approved admin user
     */
    const _userId = get(this, '_doc.userId', '') || this.userId
    const _profileImage = get(this, '_doc.profileImage', '') || this.profileImage
    const userModel = await UserModel.findById(_userId).lean()
    if (_profileImage) {
      await UserModel.findByIdAndUpdate(userModel._id, { profileImage: _profileImage })
    }
    if (userModel.userRole === EUserRole.CUSTOMER) {
      if (userModel.userType === EUserType.INDIVIDUAL && userModel.individualDetail) {
        const individualCustomerModel = await IndividualCustomerModel.findById(userModel.individualDetail).lean()
        if (individualCustomerModel) {
          const _individualDetail = get(this, '_doc.individualDetail', '') || this.individualDetail
          await IndividualCustomerModel.findByIdAndUpdate(individualCustomerModel._id, _individualDetail)
        }
      } else if (userModel.userType === EUserType.BUSINESS) {
        const businessCustomerModel = await BusinessCustomerModel.findById(userModel.businessDetail).lean()
        if (businessCustomerModel) {
          const _businessDetail = get(this, '_doc.businessDetail', '') || this.businessDetail
          const { changePaymentMethodRequest, creditPayment, ...detail } = _businessDetail
          let creditId = null
          let cashId = null
          if (detail.paymentMethod === EPaymentMethod.CREDIT) {
            // Update Credit
            if (businessCustomerModel.creditPayment) {
              const creditModel = await BusinessCustomerCreditPaymentModel.findById(
                businessCustomerModel.creditPayment,
              ).lean()
              await BusinessCustomerCreditPaymentModel.findByIdAndUpdate(
                creditModel._id,
                creditPayment as BusinessCustomerCreditPayment,
              )
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

const UserPendingModel = getModelForClass(UserPending)

export default UserPendingModel
