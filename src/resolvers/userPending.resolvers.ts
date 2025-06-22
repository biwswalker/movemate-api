import { Resolver, Query, Arg, Ctx, UseMiddleware, Args, Mutation } from 'type-graphql'
import UserModel from '@models/user.model'
import { GetUserPendingArgs } from '@inputs/user.input'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { get, isArray, isEmpty, map, omit, reduce } from 'lodash'
import { UserPendingAggregatePayload } from '@payloads/user.payloads'
import { PaginateOptions } from 'mongoose'
import { PaginationArgs } from '@inputs/query.input'
import { GraphQLError } from 'graphql'
import { CutomerBusinessInput } from '@inputs/customer.input'
import FileModel from '@models/file.model'
import BusinessCustomerModel, { BusinessCustomer } from '@models/customerBusiness.model'
import BusinessCustomerCreditPaymentModel, {
  BusinessCustomerCreditPayment,
  EDataStatus,
} from '@models/customerBusinessCreditPayment.model'
import { BusinessCustomerSchema } from '@validations/customer.validations'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { EPaymentMethod } from '@enums/payments'
import { EDriverType, EUpdateUserStatus, EUserRole } from '@enums/users'
import UserPendingModel, { UserPending } from '@models/userPending.model'
import { GET_PENDING_USERS } from '@pipelines/userPending.pipeline'
import { WithTransaction } from '@middlewares/RetryTransaction'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import { DriverUpdateInput } from '@inputs/driver.input'
import DriverDetailModel from '@models/driverDetail.model'
import { BusinessDriverScema, IndividualDriverScema } from '@validations/driver.validations'
import DriverDocumentModel from '@models/driverDocument.model'

@Resolver(UserPending)
export default class UserPendingResolver {
  @Query(() => UserPendingAggregatePayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async pendingUsers(
    @Args() query: GetUserPendingArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs,
  ): Promise<UserPendingAggregatePayload> {
    try {
      const { sort, ...pagination }: PaginateOptions = {
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

      const aggregate = UserPendingModel.aggregate(GET_PENDING_USERS(query, sort))
      console.log('aggregate: ', JSON.stringify(aggregate, undefined, 2))
      const users = (await UserPendingModel.aggregatePaginate(aggregate, pagination)) as UserPendingAggregatePayload

      return users
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async allpendinguserIds(@Args() query: GetUserPendingArgs): Promise<string[]> {
    try {
      const users = await UserPendingModel.aggregate(GET_PENDING_USERS(query))
      const ids = map(users, ({ _id }) => _id)
      return ids
    } catch (error) {
      console.log(error)
      throw new GraphQLError('ไม่สามารถเรียกรายการลูกค้าได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async updateCustomerRequest(
    @Arg('id') id: string,
    @Arg('data') data: CutomerBusinessInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const session = ctx.session
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (id) {
        await BusinessCustomerSchema(id).validate(data, { abortEarly: false })

        const userModel = await UserModel.findById(id).session(session)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const existingPendingRequest = await UserPendingModel.findOne({
          userNumber: userModel.userNumber,
          approvalBy: null,
          status: EUpdateUserStatus.PENDING,
        }).session(session)

        if (existingPendingRequest) {
          const message = 'มีคำขอแก้ไขข้อมูลที่รอการอนุมัติอยู่แล้ว'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        // TODO: If no change force return

        const customerBusinesslModel = await BusinessCustomerModel.findById(userModel.businessDetail).session(session)
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
          await uploadedImage.save({ session })
        }

        let _creditInfo: BusinessCustomerCreditPayment | undefined = undefined
        if (formValue.paymentMethod === EPaymentMethod.CREDIT && creditPayment) {
          const creditDetail = await BusinessCustomerCreditPaymentModel.findById(
            customerBusinesslModel.creditPayment,
          ).session(session)
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
            await businessRegistrationCertificate.save({ session })
          }
          // Document Image 2
          const copyIDAuthorizedSignatory = copyIDAuthorizedSignatoryFile
            ? new FileModel(copyIDAuthorizedSignatoryFile)
            : null
          if (copyIDAuthorizedSignatory) {
            await copyIDAuthorizedSignatory.save({ session })
          }
          // Document Image 3
          const certificateValueAddedTaxRegistration = certificateValueAddedTaxRegistrationFile
            ? new FileModel(certificateValueAddedTaxRegistrationFile)
            : null
          if (certificateValueAddedTaxRegistration) {
            await certificateValueAddedTaxRegistration.save({ session })
          }

          const _creditPayment = new BusinessCustomerCreditPaymentModel({
            ...creditDetail,
            ...omit(creditPayment, [
              'businessRegistrationCertificateFile',
              'copyIDAuthorizedSignatoryFile',
              'certificateValueAddedTaxRegistrationFile',
            ]),
            ...(businessRegistrationCertificate
              ? { businessRegistrationCertificateFile: businessRegistrationCertificate._id }
              : { businessRegistrationCertificateFile: creditDetail.businessRegistrationCertificateFile }),
            ...(copyIDAuthorizedSignatory
              ? { copyIDAuthorizedSignatoryFile: copyIDAuthorizedSignatory }
              : { copyIDAuthorizedSignatoryFile: creditDetail.copyIDAuthorizedSignatoryFile }),
            ...(certificateValueAddedTaxRegistration
              ? { certificateValueAddedTaxRegistrationFile: certificateValueAddedTaxRegistration }
              : { certificateValueAddedTaxRegistrationFile: creditDetail.certificateValueAddedTaxRegistrationFile }),
            dataStatus: EDataStatus.DRAFT,
          })
          await _creditPayment.save({ session })
          _creditInfo = _creditPayment
        }

        const _business: BusinessCustomer = {
          ...customerBusinesslModel,
          ...formValue,
          businessEmail,
          ...(_creditInfo ? { creditPayment: _creditInfo?._id || '' } : {}),
        }

        const _userPending = new UserPendingModel({
          user: userModel._id,
          userId: userModel._id,
          userNumber: userModel.userNumber,
          businessDetail: _business,
          profileImage: uploadedImage ? uploadedImage : userModel.profileImage,
          status: EUpdateUserStatus.PENDING,
        })

        await _userPending.save({ session })

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
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async updateDriverRequest(
    @Arg('id') id: string,
    @Arg('data') data: DriverUpdateInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const session = ctx.session
    const { documents, detail } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (id) {
        const userModel = await UserModel.findById(id).session(session)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const driverDetailModel = await DriverDetailModel.findById(userModel.driverDetail).session(session)
        if (!driverDetailModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลคนขับได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        const existingPendingRequest = await UserPendingModel.findOne({
          userNumber: userModel.userNumber,
          approvalBy: null,
          status: EUpdateUserStatus.PENDING,
        }).session(session)

        if (existingPendingRequest) {
          const message = 'มีคำขอแก้ไขข้อมูลที่รอการอนุมัติอยู่แล้ว'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }

        if (driverDetailModel.driverType.includes(EDriverType.BUSINESS)) {
          await BusinessDriverScema(id).validate(detail, { abortEarly: false })
        } else if (
          driverDetailModel.driverType.includes(EDriverType.INDIVIDUAL_DRIVER) ||
          driverDetailModel.driverType.includes(EDriverType.BUSINESS_DRIVER)
        ) {
          await IndividualDriverScema(id).validate(detail, { abortEarly: false })
        }

        // Handle document files
        const driverDocumentModel = await DriverDocumentModel.findById(driverDetailModel.documents).session(session)

        // Profile Image
        const uploadedImage = detail.profileImage ? new FileModel(detail.profileImage) : null
        if (uploadedImage) {
          await uploadedImage.save({ session })
        }

        const _driverDetail = {
          ...driverDetailModel.toObject(),
          ...detail,
          documents: driverDocumentModel._id,
        }

        const _userPending = new UserPendingModel({
          user: userModel._id,
          userId: userModel._id,
          userNumber: userModel.userNumber,
          driverDetail: _driverDetail,
          profileImage: uploadedImage ? uploadedImage._id : userModel.profileImage,
          status: EUpdateUserStatus.PENDING,
        })

        await _userPending.save({ session })

        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลคนขับได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
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

  @Query(() => UserPending)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPendingUser(@Arg('id') id: string): Promise<UserPending> {
    try {
      const pendingUser = await UserPendingModel.findById(id)
      if (!pendingUser) {
        throw new GraphQLError('ไม่พบคำขอแก้ไขข้อมูล')
      }
      return pendingUser
    } catch (error) {
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลคำขอแก้ไขได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async processPendingUser(
    @Arg('pendingId') pendingId: string,
    @Arg('status', () => EUpdateUserStatus) status: EUpdateUserStatus,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const session = ctx.session
    const adminId = ctx.req.user_id

    try {
      const pendingRequest = await UserPendingModel.findById(pendingId).session(session)

      if (!pendingRequest) {
        throw new GraphQLError('ไม่พบคำขอแก้ไขข้อมูล')
      }

      if (pendingRequest.status !== EUpdateUserStatus.PENDING) {
        throw new GraphQLError('คำขอนี้ได้รับการดำเนินการไปแล้ว')
      }

      if (status === EUpdateUserStatus.APPROVE) {
        // Copy data from pending to actual user
        await pendingRequest.copy()

        // Update pending request status
        pendingRequest.status = EUpdateUserStatus.APPROVE
        pendingRequest.approvalBy = adminId as any // Cast because Ref<User>
        await pendingRequest.save({ session })

        // Send notification to user
        await NotificationModel.sendNotification(
          {
            userId: pendingRequest.userId,
            varient: ENotificationVarient.SUCCESS,
            title: 'คำขอแก้ไขข้อมูลได้รับการอนุมัติ',
            message: ['ข้อมูลของคุณได้รับการอัปเดตเรียบร้อยแล้ว'],
          },
          session,
        )
      } else if (status === EUpdateUserStatus.REJECT) {
        // Update pending request status
        pendingRequest.status = EUpdateUserStatus.REJECT
        pendingRequest.approvalBy = adminId as any // Cast because Ref<User>
        await pendingRequest.save({ session })

        // Send notification to user
        await NotificationModel.sendNotification(
          {
            userId: pendingRequest.userId,
            varient: ENotificationVarient.ERROR,
            title: 'คำขอแก้ไขข้อมูลถูกปฏิเสธ',
            message: ['คำขอแก้ไขข้อมูลของคุณถูกปฏิเสธโดยผู้ดูแลระบบ'],
          },
          session,
        )
      } else {
        throw new GraphQLError('สถานะการดำเนินการไม่ถูกต้อง')
      }

      return true
    } catch (error) {
      console.log('error: ', error)
      throw error
    }
  }

  @Query(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async checkUserPendingStatus(@Arg('userId') userId: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    const requesterId = ctx.req.user_id
    const requesterRole = ctx.req.user_role

    // Security check: Allow admins to check anyone, but other users can only check themselves.
    if (requesterRole !== EUserRole.ADMIN && requesterId !== userId) {
      throw new GraphQLError('You are not authorized to perform this action for another user.')
    }

    try {
      const pendingRequest = await UserPendingModel.findOne({
        userId: userId,
        status: EUpdateUserStatus.PENDING,
      })

      return !!pendingRequest
    } catch (error) {
      console.log('Error checking user pending status:', error)
      throw new GraphQLError('Failed to check user pending status.')
    }
  }
}
