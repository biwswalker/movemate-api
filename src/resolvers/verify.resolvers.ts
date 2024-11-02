import { Resolver, Mutation, UseMiddleware, Ctx, Arg, Args } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import UserModel from '@models/user.model'
import { GraphQLError } from 'graphql'
import { IndividualCustomer } from '@models/customerIndividual.model'
import addEmailQueue from '@utils/email.utils'
import { getCurrentHost } from '@utils/string.utils'
import { addMinutes } from 'date-fns'
import { VerifyOTPPayload, VerifyPayload } from '@payloads/verify.payloads'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { VerifyOTPArgs } from '@inputs/verify.payloads'
import { get, isEqual } from 'lodash'
import { requestOTP } from './otp.resolvers'
import { generateExpToken } from '@utils/encryption'
import { EUserRole, EUserType } from '@enums/users'

@Resolver()
export default class VerifyAccountResolver {
  @Mutation(() => VerifyPayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async resentEmail(
    @Ctx() ctx: GraphQLContext,
    @Arg('userId', { nullable: true }) userId: string,
  ): Promise<VerifyPayload> {
    const _id = userId ? userId : ctx.req.user_id
    try {
      const user = await UserModel.findById(_id)

      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      const host = getCurrentHost(ctx)
      const userNumberToken = generateExpToken({ userNumber: user.userNumber })
      const activate_link = `${host}/api/v1/activate/customer/${userNumberToken}`
      const movemate_link = `https://www.movematethailand.com`

      let email = ''
      let fullname = ''
      if (user.userType === EUserType.INDIVIDUAL && user.individualDetail) {
        const individualDetail = user.individualDetail as IndividualCustomer
        email = individualDetail.email
        fullname = individualDetail.fullname
      } else if (user.userType === EUserType.BUSINESS && user.businessDetail) {
        const businessDetail = user.businessDetail as BusinessCustomer
        email = businessDetail.businessEmail
        fullname = businessDetail.businessName
      }

      if (!email) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบอีเมลผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      await addEmailQueue({
        from: process.env.NOREPLY_EMAIL,
        to: email,
        subject: 'ยืนยันอีเมล Movemate!',
        template: 'confirm_email',
        context: {
          fullname,
          username: user.username,
          activate_link,
          movemate_link,
        },
      })

      const currentDate = new Date()
      const countdown = addMinutes(currentDate, 1)
      const duration = `1m`

      return {
        countdown,
        duration,
      }
    } catch (error) {
      console.log('errorr', error)
      throw error
    }
  }

  @Mutation(() => VerifyOTPPayload)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async resentOTP(
    @Ctx() ctx: GraphQLContext,
    @Arg('userId', { nullable: true }) userId: string,
  ): Promise<VerifyOTPPayload> {
    const _id = userId ? userId : ctx.req.user_id
    try {
      const user = await UserModel.findById(_id)

      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      const endTime = new Date(user.lastestOTPTime).getTime()
      if (Date.now() < endTime) {
        const message = 'ไม่สามารถส่ง OTP ได้ในขนะนี้ กรุณาลองใหม่'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      const phoneNumber =
        user.userRole === EUserRole.CUSTOMER && user.userType === EUserType.INDIVIDUAL
          ? get(user, 'individualDetail.phoneNumber', '')
          : user.userRole === EUserRole.CUSTOMER && user.userType === EUserType.BUSINESS
          ? get(user, 'businessDetail.contactNumber', '')
          : user.userRole === EUserRole.DRIVER
          ? get(user, 'driverDetail.phoneNumber', '')
          : ''
      const { otp, ref, countdown } = await requestOTP(
        phoneNumber,
        ctx.req.user_role === EUserRole.ADMIN ? 'ผู้ดูแลระบบ ส่ง OTP เพื่อยืนยันหมายเลขติดต่อ' : 'ยืนยันหมายเลขติดต่อ',
      )
      const duration = `2m`
      await user.updateOne({ lastestOTP: otp, lastestOTPRef: ref, lastestOTPTime: countdown })
      return {
        countdown,
        duration,
        ref,
      }
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN]))
  async verifyOTP(@Args() data: VerifyOTPArgs): Promise<boolean> {
    try {
      const user = await UserModel.findById(data.id)
      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      // TODO: Handle time range

      if (user.isVerifiedPhoneNumber) {
        const message = 'ผู้ใช้ถูกยืนยันหมายเลขโทรศัพท์แล้ว'
        throw new GraphQLError(message)
      }

      if (isEqual(user.lastestOTPRef, data.ref) && isEqual(user.lastestOTP, data.otp)) {
        await user.updateOne({ isVerifiedPhoneNumber: true })
        return true
      }

      const message = 'OTP ไม่ตรงกัน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async markAsVerifiedEmail(@Arg('userId') userId: string): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      if (user.isVerifiedEmail) {
        const message = 'ผู้ใช้ถูกยืนยันอีเมลแล้ว'
        throw new GraphQLError(message)
      }

      await user.updateOne({ isVerifiedEmail: true })

      return true
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async markAsVerifiedOTP(@Arg('userId') userId: string): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        const message = 'ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      if (user.isVerifiedPhoneNumber) {
        const message = 'ผู้ใช้ถูกยืนยันหมายเลขโทรศัพท์แล้ว'
        throw new GraphQLError(message)
      }

      await user.updateOne({ isVerifiedPhoneNumber: true })

      return true
    } catch (error) {
      throw error
    }
  }
}
