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
import { EUpdateUserStatus, EUserRole } from '@enums/users'
import UserPendingModel, { UserPending } from '@models/userPending.model'
import { GET_PENDING_USERS } from '@pipelines/userPending.pipeline'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'

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
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]), RetryTransactionMiddleware)
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
          creditPayment: _creditInfo._id || '',
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
}
