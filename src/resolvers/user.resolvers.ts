import {
  Resolver,
  Query,
  Arg,
  Ctx,
  UseMiddleware,
  AuthenticationError,
  Args,
  Mutation,
  InvalidDirectiveError,
  Subscription,
  SubscribeResolverData,
  Root,
} from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import { GetUserArgs } from '@inputs/user.input'
import { AuthGuard } from '@guards/auth.guards'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { find, get, includes, isArray, isEmpty, isEqual, map, omit, omitBy, pick, reduce } from 'lodash'
import { RequireDataBeforePayload, UserPaginationAggregatePayload } from '@payloads/user.payloads'
import { PaginateOptions } from 'mongoose'
import { PaginationArgs } from '@inputs/query.input'
import { GraphQLError } from 'graphql'
import {
  AcceptedPolicyInput,
  CutomerBusinessInput,
  CutomerIndividualInput,
  ResetPasswordInput,
} from '@inputs/customer.input'
import CustomerIndividualModel, { IndividualCustomer } from '@models/customerIndividual.model'
import FileModel from '@models/file.model'
import BusinessCustomerModel, { BusinessCustomer } from '@models/customerBusiness.model'
import BusinessCustomerCreditPaymentModel from '@models/customerBusinessCreditPayment.model'
import addEmailQueue from '@utils/email.utils'
import { generateId, generateOTP, generateRandomNumberPattern, generateRef, getCurrentHost } from '@utils/string.utils'
import bcrypt from 'bcrypt'
import { GET_USERS } from '@pipelines/user.pipeline'
import { BusinessCustomerSchema, IndividualCustomerSchema } from '@validations/customer.validations'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import BusinessCustomerCashPaymentModel from '@models/customerBusinessCashPayment.model'
import SettingCustomerPoliciesModel from '@models/settingCustomerPolicies.model'
import SettingDriverPoliciesModel from '@models/settingDriverPolicies.model'
import { VerifyPayload } from '@payloads/verify.payloads'
import { addHours, addMinutes, addSeconds } from 'date-fns'
import { decryption, generateExpToken } from '@utils/encryption'
import NotificationModel, {
  ENavigationType,
  ENotificationVarient,
  NOTIFICATION_TITLE,
} from '@models/notification.model'
import { fDateTime } from '@utils/formatTime'
import DriverDetailModel, { DriverDetail } from '@models/driverDetail.model'
import { getAdminMenuNotificationCount } from './notification.resolvers'
import pubsub, { NOTFICATIONS, USERS } from '@configs/pubsub'
import { FileInput } from '@inputs/file.input'
import { EPaymentMethod } from '@enums/payments'
import { EDriverType, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { credit, sendSMS } from '@services/sms/thaibulk'

@Resolver(User)
export default class UserResolver {
  @Query(() => UserPaginationAggregatePayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async users(
    @Args() query: GetUserArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs,
  ): Promise<UserPaginationAggregatePayload> {
    try {
      const pagination: PaginateOptions = {
        ...paginationArgs,
        ...(isArray(sortField)
          ? {
              sort: reduce(
                sortField,
                function (result, value) {
                  return { ...result, [value]: sortAscending ? 1 : -1 }
                },
                {},
              ),
            }
          : {}),
      }

      const filterQuery = omitBy(query, isEmpty)
      const aggregate = UserModel.aggregate(GET_USERS(filterQuery))
      console.log('aggregate: ', JSON.stringify(aggregate, undefined, 2))
      const users = (await UserModel.aggregatePaginate(aggregate, pagination)) as UserPaginationAggregatePayload

      return users
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async alluserIds(@Args() query: GetUserArgs): Promise<string[]> {
    try {
      const filterQuery = omitBy(query, isEmpty)
      const users = await UserModel.aggregate(GET_USERS(filterQuery))
      const ids = map(users, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async getUserByUsername(@Arg('username') username: string): Promise<User> {
    try {
      const user = await UserModel.findByUsername(username)
      if (!user) {
        const message = `ไม่พบผู้ใช้ ${username}`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return user
    } catch (error) {
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.DRIVER]))
  async lookupDriverByPhonenumber(@Arg('phonenumber') phonenumber: string): Promise<User | null> {
    try {
      // Check existing business agent
      const businessAgent = await DriverDetailModel.findOne({
        phoneNumber: phonenumber,
        driverType: { $in: [EDriverType.BUSINESS] },
      })
      console.log('1.-businessAgent-----> ')
      if (businessAgent) {
        console.log('2.-businessAgent-----> ')
        const message = `เบอร์นี้ผู้ใช้แล้ว`
        throw new GraphQLError(message, {
          extensions: { code: 'EXISTING_DRIVER_PHONENUMBER', errors: [{ message }] },
        })
      }

      const driverDetail = await DriverDetailModel.findOne({
        phoneNumber: phonenumber,
        $or: [
          { driverType: { $in: [EDriverType.INDIVIDUAL_DRIVER] } },
          { driverType: { $in: [EDriverType.BUSINESS_DRIVER] } },
        ],
      })
      if (!driverDetail) {
        const message = `ไม่พบผู้ใช้ ${phonenumber}`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const user = await UserModel.findOne({ userRole: EUserRole.DRIVER, driverDetail })
      if (!user) {
        const message = `ไม่พบผู้ใช้ ${phonenumber}`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return user
    } catch (error) {
      throw error
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async getUser(@Args() data: GetUserArgs): Promise<User> {
    try {
      const filter = pick(data, [
        '_id',
        'userNumber',
        'userRole',
        'userType',
        'username',
        'status',
        'validationStatus',
        'registration',
        'lastestOTP',
        'lastestOTPRef',
        'isVerifiedEmail',
        'isVerifiedPhoneNumber',
      ])
      const user = await UserModel.findOne(filter)
      if (!user) {
        const message = `ไม่พบผู้ใช้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return user
    } catch (error) {
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลผู้ใช้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => User)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async me(@Ctx() ctx: GraphQLContext): Promise<User> {
    try {
      const userId = ctx.req.user_id
      if (!userId) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }

      return user
    } catch (error) {
      throw error
    }
  }

  @Query(() => RequireDataBeforePayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async requireBeforeSignin(@Ctx() ctx: GraphQLContext): Promise<RequireDataBeforePayload> {
    try {
      const userId = ctx.req.user_id
      if (!userId) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }

      // Check policy
      let requireAcceptedPolicy = true
      if (user.userRole === EUserRole.CUSTOMER) {
        const settingCustomerPolicies = await SettingCustomerPoliciesModel.find()
        const policyVersion = get(settingCustomerPolicies, '0.version', 0)
        if (user.acceptPolicyVersion >= policyVersion) {
          requireAcceptedPolicy = false
        } else {
          requireAcceptedPolicy = true
        }
      } else if (user.userRole === EUserRole.DRIVER) {
        const settingDriverPolicies = await SettingDriverPoliciesModel.find()
        const policyVersion = get(settingDriverPolicies, '0.version', 0)
        if (user.acceptPolicyVersion >= policyVersion) {
          requireAcceptedPolicy = false
        } else {
          requireAcceptedPolicy = true
        }
      }

      return {
        requireAcceptedPolicy,
        requirePasswordChange: user.isChangePasswordRequire,
      }
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async updateIndividualCustomer(
    @Arg('id') id: string,
    @Arg('data') data: CutomerIndividualInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { email, profileImage, ...formValue } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (id) {
        await IndividualCustomerSchema(id).validate(data, { abortEarly: false })
        const userModel = await UserModel.findById(id)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const customerIndividualModel = await CustomerIndividualModel.findById(userModel.individualDetail)
        if (!customerIndividualModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const uploadedImage = profileImage ? new FileModel(profileImage) : null
        if (uploadedImage) {
          await uploadedImage.save()
        }

        await userModel.updateOne({
          ...formValue,
          username: email,
          ...(uploadedImage ? { profileImage: uploadedImage } : {}),
        })
        await customerIndividualModel.updateOne({ ...formValue, email })

        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async updateBusinessCustomer(
    @Arg('id') id: string,
    @Arg('data') data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (id) {
        await BusinessCustomerSchema(id).validate(data, { abortEarly: false })

        const userModel = await UserModel.findById(id)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const customerBusinesslModel = await BusinessCustomerModel.findById(userModel.businessDetail)
        if (!customerBusinesslModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        // Profil Image
        const uploadedImage = profileImage ? new FileModel(profileImage) : null
        if (uploadedImage) {
          await uploadedImage.save()
        }

        if (formValue.paymentMethod === EPaymentMethod.CREDIT && creditPayment) {
          const creditDetail = await BusinessCustomerCreditPaymentModel.findById(customerBusinesslModel.creditPayment)
          if (!creditDetail) {
            const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบข้อมูลการเงิน'
            throw new GraphQLError(message, {
              extensions: {
                code: 'NOT_FOUND',
                errors: [{ message }],
              },
            })
          }

          const businessRegistrationCertificateFile = get(creditPayment, 'businessRegistrationCertificateFile', null)
          const copyIDAuthorizedSignatoryFile = get(creditPayment, 'copyIDAuthorizedSignatoryFile', null)
          const certificateValueAddedTaxRegistrationFile = get(
            creditPayment,
            'certificateValueAddedTaxRegistrationFile',
            null,
          )

          // Document Image 1
          const businessRegistrationCertificate = businessRegistrationCertificateFile
            ? new FileModel(businessRegistrationCertificateFile)
            : null
          if (businessRegistrationCertificate) {
            await businessRegistrationCertificate.save()
          }
          // Document Image 2
          const copyIDAuthorizedSignatory = copyIDAuthorizedSignatoryFile
            ? new FileModel(copyIDAuthorizedSignatoryFile)
            : null
          if (copyIDAuthorizedSignatory) {
            await copyIDAuthorizedSignatory.save()
          }
          // Document Image 3
          const certificateValueAddedTaxRegistration = certificateValueAddedTaxRegistrationFile
            ? new FileModel(certificateValueAddedTaxRegistrationFile)
            : null
          if (certificateValueAddedTaxRegistration) {
            await certificateValueAddedTaxRegistration.save()
          }

          await creditDetail.updateOne({
            ...omit(creditPayment, [
              'businessRegistrationCertificateFile',
              'copyIDAuthorizedSignatoryFile',
              'certificateValueAddedTaxRegistrationFile',
            ]),
            ...(businessRegistrationCertificate
              ? { businessRegistrationCertificateFile: businessRegistrationCertificate }
              : {}),
            ...(copyIDAuthorizedSignatory ? { copyIDAuthorizedSignatoryFile: copyIDAuthorizedSignatory } : {}),
            ...(certificateValueAddedTaxRegistration
              ? { certificateValueAddedTaxRegistrationFile: certificateValueAddedTaxRegistration }
              : {}),
          })
        }

        await userModel.updateOne({
          ...formValue,
          ...(uploadedImage ? { profileImage: uploadedImage } : {}),
        })

        await customerBusinesslModel.updateOne({ ...formValue, businessEmail })

        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async approvalUser(
    @Arg('id') id: string,
    @Arg('result') result: EUserValidationStatus,
    @Ctx() ctx: GraphQLContext,
  ): Promise<User> {
    try {
      if (!id) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }
      const user = await UserModel.findById(id).exec()

      if (!user) {
        throw new AuthenticationError('ไม่พบผู้ใช้')
      }

      // Check pending status
      if (user.validationStatus !== EUserValidationStatus.PENDING) {
        throw new GraphQLError('ผู้ใช้ท่านนี้มีการอนุมัติเรียบร้อยแล้ว')
      }
      // Check approval status
      if (!includes([EUserValidationStatus.APPROVE, EUserValidationStatus.DENIED], result)) {
        throw new InvalidDirectiveError('สถานะไม่ถูกต้อง')
      }

      // ===== CUSTOMER ROLE
      if (user.userRole === EUserRole.CUSTOMER) {
        const individualDetail: IndividualCustomer | null = get(user, 'individualDetail', null)
        const businessDetail: BusinessCustomer | null = get(user, 'businessDetail', null)
        const upgradeRequest: BusinessCustomer | null = get(user, 'upgradeRequest', null)
        const businesData: BusinessCustomer | null =
          user.userType === EUserType.INDIVIDUAL ? upgradeRequest : businessDetail

        // Check Business Detail
        if (typeof businesData !== 'object') {
          throw new InvalidDirectiveError('ไม่พบข้อมูลธุระกิจ')
        }

        const status = result === EUserValidationStatus.APPROVE ? EUserStatus.ACTIVE : EUserStatus.DENIED
        // Title name
        const BUSINESS_TITLE_NAME_OPTIONS = [
          { value: 'Co', label: 'บจก.' },
          { value: 'Part', label: 'หจก.' },
          { value: 'Pub', label: 'บมจ.' },
        ]

        const businessTitleName = find(BUSINESS_TITLE_NAME_OPTIONS, ['value', businesData.businessTitle])

        if (result === EUserValidationStatus.APPROVE) {
          const rawPassword = generateRandomNumberPattern('MMPWD########').toLowerCase()
          const hashedPassword = await bcrypt.hash(rawPassword, 10)

          if (user.userType === EUserType.INDIVIDUAL) {
            const userNumber = await generateId('MMBU', 'business')
            const newBusinessDetail = {
              userNumber,
              username: userNumber,
              userType: EUserType.BUSINESS,
              businessDetail: businesData,
              upgradeRequest: null,
              isChangePasswordRequire: true,
            }
            await user.updateOne({ status, validationStatus: result, password: hashedPassword, ...newBusinessDetail })
            const movemate_link = `https://www.movematethailand.com`
            await addEmailQueue({
              from: process.env.NOREPLY_EMAIL,
              to: businesData.businessEmail,
              subject: 'บัญชี Movemate ของท่านได้รับการอนุมัติ',
              template: 'register_business_upgrade',
              context: {
                business_title: get(businessTitleName, 'label', ''),
                business_name: businesData.businessName,
                username: userNumber,
                password: rawPassword,
                movemate_link,
              },
            })
            await NotificationModel.sendNotification({
              userId: user._id,
              varient: ENotificationVarient.SUCCESS,
              title: 'บัญชีของท่านได้รับการอัพเกรดแล้ว',
              message: [`บัญชี ${userNumber} ได้อัพเกรดเป็นรูปแบบ corporate แล้ว ท่านสามารถใช้งานได้ในขณะนี้`],
              infoText: 'ดูโปรไฟล์',
              infoLink: '/main/profile',
            })
          } else {
            await user.updateOne({ status, validationStatus: result, password: hashedPassword })
            const host = getCurrentHost(ctx)
            const userNumberToken = generateExpToken({ userNumber: user.userNumber })
            const activate_link = `${host}/api/v1/activate/customer/${userNumberToken}`
            const movemate_link = `https://www.movematethailand.com`
            await addEmailQueue({
              from: process.env.NOREPLY_EMAIL,
              to: businesData.businessEmail,
              subject: 'บัญชี Movemate ของท่านได้รับการอนุมัติ',
              template: 'register_business',
              context: {
                business_title: get(businessTitleName, 'label', ''),
                business_name: businesData.businessName,
                username: user.username,
                password: rawPassword,
                activate_link,
                movemate_link,
              },
            })
          }
        } else {
          // Update user
          const newBusinessDetail =
            user.userType === EUserType.INDIVIDUAL
              ? {
                  upgradeRequest: null,
                  validationStatus: EUserValidationStatus.PENDING,
                  status: EUserStatus.ACTIVE,
                }
              : {}

          const sentemail = user.userType === EUserType.INDIVIDUAL ? individualDetail.email : businesData.businessEmail

          await user.updateOne({ status, validationStatus: result, ...newBusinessDetail })
          await addEmailQueue({
            from: process.env.NOREPLY_EMAIL,
            to: sentemail,
            subject: 'บัญชี Movemate ของท่านไม่ได้รับการอนุมัติ',
            template: 'register_rejected_account',
            context: {
              business_title: get(businessTitleName, 'label', ''),
              business_name: businesData.businessName,
              movemate_link: `https://www.movematethailand.com`,
            },
          })

          if (user.userType === EUserType.INDIVIDUAL) {
            await NotificationModel.sendNotification({
              userId: user._id,
              varient: ENotificationVarient.ERROR,
              title: 'การอัพเกรดบัญชีไม่ได้รับการอนุมัติ',
              message: [
                `บัญชี ${businesData.businessName} ไม่ผ่านพิจารณาการอัพเกรดเป็นรูปแบบ corporate หากมีข้อสงสัยโปรดติดต่อเรา`,
              ],
            })
          }
        }
      } else if (user.userRole === EUserRole.DRIVER) {
        // ===== DRIVER ROLE
        const isApproved = result === EUserValidationStatus.APPROVE
        const status = isApproved ? EUserStatus.ACTIVE : EUserStatus.DENIED
        const driverDetail: DriverDetail | null = get(user, 'driverDetail', null)
        if (includes(driverDetail.driverType, EDriverType.BUSINESS_DRIVER)) {
          // Business driver
          // New driver and notify
          const password_decryption = generateRef(10).toLowerCase()
          const hashedPassword = await bcrypt.hash(password_decryption, 10)
          await user.updateOne({
            status,
            validationStatus: result,
            password: hashedPassword,
            isChangePasswordRequire: true,
          })

          // Sent password
          const smsMessage = `รหัสสำหรับเข้าสู่ระบบของ Movemate Driver ของคุณคือ ${password_decryption}`

          // Request to thai bulk sms
          if (process.env.NODE_ENV === 'production') {
            const smscredit = await credit().catch((error) => {
              console.log('credit error: ', error)
            })
            console.log('ThaiBulk Credit Remaining: ', smscredit)
            await sendSMS({
              message: smsMessage,
              msisdn: driverDetail.phoneNumber,
            }).catch((error) => {
              console.log('sendSMS error: ', error)
            })
          } else if (process.env.NODE_ENV === 'development') {
            console.log('OTP message: ', smsMessage)
          }
        } else {
          await user.updateOne({ status, validationStatus: result })
        }

        const title = isApproved ? 'บัญชีของท่านได้รับการอนุมัติ' : 'บัญชีของท่านไม่ผ่านการอนุมัติ'
        const messages = isApproved
          ? ['ขอแสดงความยินดีด้วย', 'บัญชีของท่านได้รับการอนุมัติเป็นคนขับของ Movemate หากมีข้อสงสัยโปรดติดต่อเรา']
          : [`บัญชี ${driverDetail.fullname} ไม่ผ่านพิจารณาคนขับ Movemvate หากมีข้อสงสัยโปรดติดต่อเรา`]
        await NotificationModel.sendNotification({
          userId: user._id,
          varient: isApproved ? ENotificationVarient.SUCCESS : ENotificationVarient.ERROR,
          title: title,
          message: messages,
        })

        if (
          user.fcmToken &&
          includes([EUserStatus.ACTIVE, EUserStatus.BANNED, EUserStatus.DENIED, EUserStatus.INACTIVE], status)
        )
          await NotificationModel.sendFCMNotification({
            token: user.fcmToken,
            data: { navigation: ENavigationType.NOTIFICATION },
            notification: {
              title: NOTIFICATION_TITLE,
              body: isApproved
                ? 'ขอแสดงความยินดีด้วย บัญชีของท่านได้รับการอนุมัติเป็นคนขับของ Movemate'
                : `บัญชี ${driverDetail.fullname} ไม่ผ่านพิจารณาคนขับ Movemvate หากมีข้อสงสัยโปรดติดต่อเรา`,
            },
          })
        await pubsub.publish(USERS.STATUS, user._id, status)
      }

      const adminNotificationCount = await getAdminMenuNotificationCount()
      await pubsub.publish(NOTFICATIONS.GET_MENU_BADGE_COUNT, adminNotificationCount)

      return user
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async upgradeAccount(
    @Arg('id') id: string,
    @Arg('data') data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (id) {
        await BusinessCustomerSchema(id).validate(data, { abortEarly: false })

        const userModel = await UserModel.findById(id)
        if (!userModel) {
          const message = 'ไม่สามารถอัพเกรดได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        if (userModel.userType === EUserType.BUSINESS || userModel.businessDetail) {
          const message = 'ไม่สามารถอัพเกรดได้ เนื่องจากเป็นสมาชิกรูปแบบ Business อยู่แล้ว'
          throw new GraphQLError(message)
        }

        if (userModel.upgradeRequest) {
          const message = 'ไม่สามารถอัพเกรดได้ เนื่องจากมีคำขอก่อนหน้านี้แล้ว'
          throw new GraphQLError(message)
        }

        const userNumber = await generateId('MMBU', 'business')

        const businessRegistrationCertificateFile = get(creditPayment, 'businessRegistrationCertificateFile', null)
        const copyIDAuthorizedSignatoryFile = get(creditPayment, 'copyIDAuthorizedSignatoryFile', null)
        const certificateValueAddedTaxRegistrationFile = get(
          creditPayment,
          'certificateValueAddedTaxRegistrationFile',
          null,
        )

        // Document Image 1
        const businessRegistrationCertificate = businessRegistrationCertificateFile
          ? new FileModel(businessRegistrationCertificateFile)
          : null
        if (businessRegistrationCertificate) {
          await businessRegistrationCertificate.save()
        }
        // Document Image 2
        const copyIDAuthorizedSignatory = copyIDAuthorizedSignatoryFile
          ? new FileModel(copyIDAuthorizedSignatoryFile)
          : null
        if (copyIDAuthorizedSignatory) {
          await copyIDAuthorizedSignatory.save()
        }
        // Document Image 3
        const certificateValueAddedTaxRegistration = certificateValueAddedTaxRegistrationFile
          ? new FileModel(certificateValueAddedTaxRegistrationFile)
          : null
        if (certificateValueAddedTaxRegistration) {
          await certificateValueAddedTaxRegistration.save()
        }

        const cashPaymentDetail =
          formValue.paymentMethod === EPaymentMethod.CREDIT && cashPayment
            ? new BusinessCustomerCashPaymentModel({
                acceptedEreceiptDate: cashPayment.acceptedEReceiptDate,
              })
            : null
        if (cashPaymentDetail) {
          await cashPaymentDetail.save()
        }

        const creditPaymentDetail =
          formValue.paymentMethod === EPaymentMethod.CREDIT && creditPayment
            ? new BusinessCustomerCreditPaymentModel({
                ...omit(creditPayment, [
                  'businessRegistrationCertificateFile',
                  'copyIDAuthorizedSignatoryFile',
                  'certificateValueAddedTaxRegistrationFile',
                ]),
                ...(businessRegistrationCertificate
                  ? { businessRegistrationCertificateFile: businessRegistrationCertificate }
                  : {}),
                ...(copyIDAuthorizedSignatory ? { copyIDAuthorizedSignatoryFile: copyIDAuthorizedSignatory } : {}),
                ...(certificateValueAddedTaxRegistration
                  ? { certificateValueAddedTaxRegistrationFile: certificateValueAddedTaxRegistration }
                  : {}),
              })
            : null
        if (creditPaymentDetail) {
          await creditPaymentDetail.save()
        }

        const customer = new BusinessCustomerModel({
          userNumber,
          businessEmail,
          ...formValue,
          ...(cashPaymentDetail ? { cashPayment: cashPaymentDetail } : {}),
          ...(creditPaymentDetail ? { creditPayment: creditPaymentDetail } : {}),
        })

        await customer.save()

        await userModel.updateOne({
          validationStatus: EUserValidationStatus.PENDING,
          upgradeRequest: customer,
        })

        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.DRIVER]))
  async acceptedPolicy(@Arg('data') data: AcceptedPolicyInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      if (userId) {
        if (data.version <= 0) {
          const message = 'ข้อมูลไม่ครบ โปรลองอีกครั้ง'
          throw new GraphQLError(message)
        }

        const userModel = await UserModel.findById(userId)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        await userModel.updateOne({ acceptPolicyVersion: data.version, acceptPolicyTime: new Date() })
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => VerifyPayload)
  async forgotPassword(@Arg('username') username: string, @Ctx() ctx: GraphQLContext): Promise<VerifyPayload> {
    try {
      const original = ctx.req.headers['original']
      if (username) {
        const isAdminWeb = original === 'movemate-admin'
        const isCustomerWeb = original === 'movemate-th'
        const isDriver = original === 'movemate-driver'
        const user =
          isAdminWeb || isDriver
            ? await UserModel.findByUsername(username)
            : isCustomerWeb
            ? await UserModel.findCustomerByEmail(username)
            : null
        if (!user) {
          const message = 'ไม่สามารถเรียกข้อมูลผู้ใช้ได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
        }

        if (isDriver) {
          const ref = generateRef()
          const otp = generateOTP()
          const currentDate = new Date()
          const resend_countdown = addSeconds(currentDate, 90)
          const reset_time = addMinutes(currentDate, 30)
          const verifyLast = `${otp} คือ รหัสเพื่อเปลี่ยนรหัสผ่าน Movemate Thailand ของคุณ (Ref:${ref})`
          await UserModel.findByIdAndUpdate(user._id, { resetPasswordCode: otp, lastestResetPassword: reset_time })
          const phoneNumber = username
          // Request to thai bulk sms
          if (process.env.NODE_ENV === 'production') {
            const smscredit = await credit().catch((error) => {
              console.log('credit error: ', error)
            })
            console.log('ThaiBulk Credit Remaining: ', smscredit)
            await sendSMS({
              message: verifyLast,
              msisdn: phoneNumber,
            }).catch((error) => {
              console.log('sendSMS error: ', error)
            })
          } else if (process.env.NODE_ENV === 'development') {
            console.log('OTP message: ', verifyLast)
          }
          return {
            countdown: resend_countdown,
            duration: '90s',
          }
        }

        const userType = user.userType

        const email = isAdminWeb
          ? get(user, 'adminDetail.email', '')
          : isCustomerWeb
          ? userType === EUserType.INDIVIDUAL
            ? get(user, 'individualDetail.email', '')
            : userType === EUserType.BUSINESS
            ? get(user, 'businessDetail.businessEmail', '')
            : ''
          : ''

        if (email) {
          const code = generateOTP()
          const currentDate = new Date()
          const resend_countdown = addSeconds(currentDate, 45)
          const reset_time = addMinutes(currentDate, 30)

          await UserModel.findByIdAndUpdate(user._id, { resetPasswordCode: code, lastestResetPassword: reset_time })
          const movemate_link = `https://www.movematethailand.com`
          await addEmailQueue({
            from: process.env.NOREPLY_EMAIL,
            to: email,
            subject: 'ยืนยันตัวตนคุณ',
            template: 'forgot_password',
            context: {
              code,
              movemate_link,
            },
          })
          return {
            countdown: resend_countdown,
            duration: '45s',
          }
        }
      }
      const message = 'ไม่สามารถรีเซ็ทรหัสผ่านได้ เนื่องจากไม่พบอีเมลผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  async verifyResetPassword(@Args() data: ResetPasswordInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    const original = ctx.req.headers['original']
    try {
      const isAdminWeb = original === 'movemate-admin'
      const isCustomerWeb = original === 'movemate-th'
      const isDriver = original === 'movemate-driver'
      const user =
        isAdminWeb || isDriver
          ? await UserModel.findByUsername(data.username)
          : isCustomerWeb
          ? await UserModel.findCustomerByEmail(data.username)
          : null
      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      // Verify expiry time
      if (user.lastestResetPassword) {
        const expireTime = addHours(user.lastestResetPassword, 24)
        const currentDate = new Date()
        if (currentDate.getTime() > expireTime.getTime()) {
          const message = 'หมดเวลา กรุณาดำเนินการอีกครั้ง'
          throw new GraphQLError(message, {
            extensions: {
              code: 'FAILED_VERIFY_OTP',
              errors: [{ message }],
            },
          })
        }
      } else {
        const message = 'ไม่พบเวลาคำขอเปลี่ยนรหัสผ่าน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'FAILED_VERIFY_OTP',
            errors: [{ message }],
          },
        })
      }

      // Verify code
      if (!isEmpty(user.resetPasswordCode) && isEqual(data.code, user.resetPasswordCode)) {
        // Decryption password from frontend
        const password_decryption = decryption(data.password)
        const hashedPassword = await bcrypt.hash(password_decryption, 10)
        // Get user email
        const email = isAdminWeb ? get(user, 'adminDetail.email', '') : data.username
        if (email) {
          // Save password and return
          await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword, resetPasswordCode: null })
          if (isDriver) {
            return true
          }
          // Email sender
          const movemate_link = `https://www.movematethailand.com`
          await addEmailQueue({
            from: process.env.NOREPLY_EMAIL,
            to: email,
            subject: 'เปลี่ยนรหัสผ่านบัญชีสำเร็จ',
            template: 'passwordchanged',
            context: { movemate_link },
          })
          // Notification
          const currentTime = fDateTime(new Date())
          await NotificationModel.sendNotification({
            userId: user._id,
            varient: ENotificationVarient.MASTER,
            title: 'เปลี่ยนรหัสผ่านบัญชีสำเร็จ',
            message: [`บัญชีของท่านถูกเปลี่ยนรหัสผ่านเมื่อเวลา ${currentTime} หากมีข้อสงสัยโปรดติดต่อเรา`],
          })
          return true
        } else {
          const message = 'ไม่พบอีเมล'
          throw new GraphQLError(message, { extensions: { code: 'NOT_MATCH', errors: [{ message }] } })
        }
      }
      const message = 'รหัสไม่ถูกต้อง'
      throw new GraphQLError(message, { extensions: { code: 'NOT_MATCH', errors: [{ message }] } })
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async storeFCM(@Ctx() ctx: GraphQLContext, @Arg('fcmToken') fcmToken: string): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      if (userId) {
        if (!fcmToken) {
          const message = 'ข้อมูลไม่ครบ โปรลองอีกครั้ง'
          throw new GraphQLError(message)
        }

        const userModel = await UserModel.findById(userId)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        await userModel.updateOne({ fcmToken })
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async removeFCM(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      console.log('ctx: ', ctx)
      if (userId) {
        const userModel = await UserModel.findById(userId)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        await userModel.updateOne({ fcmToken: '' })
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER, EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async updateProfileImage(
    @Ctx() ctx: GraphQLContext,
    @Arg('fileDetail') fileDetail: FileInput,
    @Arg('uid', { nullable: true }) uid: string,
  ): Promise<boolean> {
    try {
      const userId = uid || ctx.req.user_id
      console.log('ctx: ', ctx)
      if (userId) {
        const userModel = await UserModel.findById(userId)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        const file = new FileModel(fileDetail)
        await file.save()
        await userModel.updateOne({ profileImage: file })
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      throw errors
    }
  }

  @Subscription({
    topics: USERS.STATUS,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  listenUserStatus(@Root() payload: EUserStatus): EUserStatus {
    return payload
  }
}
