import { Resolver, Mutation, Arg, UseMiddleware, Query, Args } from 'type-graphql'
import OTPRequstModel, { OTPRequst } from '@models/otp.model'
import { AuthGuard } from '@guards/auth.guards'
import { addMinutes } from 'date-fns'
import { GraphQLError } from 'graphql'
import { generateOTP, generateRef } from '@utils/string.utils'
import { PaginationArgs } from '@inputs/query.input'
import { GetOTPArgs } from '@inputs/otp.input'
import { OTPPaginationPayload } from '@payloads/otp.payloads'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { reformPaginate } from '@utils/pagination.utils'
import { credit, sendSMS } from '@services/sms/thaibulk'
import { EUserRole } from '@enums/users'

const DEFUALT_OTP_DURATION = 2
const DEFUALT_OTP_EXPIRE = 20

export async function requestOTP(phoneNumber: string, action: string) {
  try {
    const VERIFY_PHONE = /^(0[689]{1})+([0-9]{8})+$/
    if (!VERIFY_PHONE.test(phoneNumber)) {
      const message = 'ไม่สามารถส่ง OTP ได้เนื่องจากหมายเลขโทรศัพไม่ถูกต้อง'
      throw new GraphQLError(message, {
        extensions: {
          code: 'UNABLE_SEND_OTP',
          errors: [{ message }],
        },
      })
    }

    const otpRequestData = await OTPRequstModel.findOne({ phoneNumber }).sort({ createdAt: -1 }).lean()
    if (otpRequestData) {
      const endTime = addMinutes(new Date(otpRequestData.sentDateTime), DEFUALT_OTP_DURATION)
      if (Date.now() < endTime.getTime()) {
        const message = 'ไม่สามารถส่ง OTP ได้ในขนะนี้ กรุณาลองใหม่'
        throw new GraphQLError(message, {
          extensions: {
            code: 'UNABLE_SEND_OTP',
            errors: [{ message }],
          },
        })
      }
    }

    const ref = generateRef()
    const otp = generateOTP()

    const verifyLast = `${otp} คือ รหัสยืนยันเบอร์ติดต่อ Movemate Thailand ของคุณ (Ref:${ref})`

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
    } else if(process.env.NODE_ENV === 'development'){
      console.log('OTP message: ', verifyLast)
    }

    const currentDate = new Date()
    const countdown = addMinutes(currentDate, DEFUALT_OTP_DURATION)
    const expire = addMinutes(currentDate, DEFUALT_OTP_EXPIRE)

    const requestModel = new OTPRequstModel({
      ref,
      otp,
      action,
      phoneNumber,
      countdown,
      sentDateTime: currentDate,
      expireDateTime: expire,
    })
    await requestModel.save()
    const otpRequestResult = await OTPRequstModel.findById(requestModel._id)
    return otpRequestResult
  } catch (error) {
    console.log('error: ', error)
    throw error
  }
}

export async function verifyOTP(phoneNumber: string, otp: string, ref: string) {
  try {
    const VERIFY_PHONE = /^(0[689]{1})+([0-9]{8})+$/
    if (!VERIFY_PHONE.test(phoneNumber)) {
      const message = 'ไม่สามารถตรวจสอบ OTP ได้เนื่องจากหมายเลขโทรศัพไม่ถูกต้อง'
      throw new GraphQLError(message, {
        extensions: {
          code: 'UNABLE_VERIFY_OTP',
          errors: [{ message }],
        },
      })
    }
    const phoneNumberData = await OTPRequstModel.findOne({ phoneNumber, ref }).sort({ createdAt: -1 }).lean()
    if (!phoneNumberData) {
      const message = 'ไม่สามารถตรวจสอบ OTP ได้เนื่องจากไม่พบข้อมูล'
      throw new GraphQLError(message, {
        extensions: {
          code: 'UNABLE_VERIFY_OTP',
          errors: [{ message }],
        },
      })
    }

    // TODO: Change this time incorrect handle
    const currentDate = new Date()
    if (currentDate.getTime() > new Date().getTime()) {
      const message = 'หมดเวลา กรุณาดำเนินการอีกครั้ง'
      throw new GraphQLError(message, {
        extensions: {
          code: 'FAILED_VERIFY_OTP',
          errors: [{ message }],
        },
      })
    }

    if (phoneNumberData.otp !== otp) {
      const message = 'OTP ไม่ถูกต้อง'
      throw new GraphQLError(message, {
        extensions: {
          code: 'FAILED_VERIFY_OTP',
          errors: [{ message }],
        },
      })
    }

    return true
  } catch (error) {
    throw error
  }
}

@Resolver()
export default class OTPRequestResolver {
  @Mutation(() => OTPRequst)
  async otpRequest(@Arg('phoneNumber') phoneNumber: string, @Arg('action') action: string): Promise<OTPRequst> {
    try {
      const requetedOTP = await requestOTP(phoneNumber, action)
      return requetedOTP
    } catch (error) {
      throw error
    }
  }

  @Mutation(() => Boolean)
  async verifyPhoneNumberOTP(
    @Arg('phoneNumber') phoneNumber: string,
    @Arg('ref') ref: string,
    @Arg('otp') otp: string,
  ): Promise<boolean> {
    return await verifyOTP(phoneNumber, otp, ref)
  }

  @Query(() => OTPRequst)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getLatestOtp(@Arg('phoneNumber') phoneNumber: string): Promise<OTPRequst> {
    try {
      const otps = await OTPRequstModel.findOne({ phoneNumber }).sort({ createdAt: -1 })
      if (!otps) {
        const message = `ไม่พบข้อมูล OTP`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return otps
    } catch (error) {
      throw error
    }
  }

  @Query(() => OTPPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getOtps(@Args() query: GetOTPArgs, @Args() paginate: PaginationArgs): Promise<OTPPaginationPayload> {
    try {
      const VERIFY_PHONE = /^(0[689]{1})+([0-9]{8})+$/
      if (!VERIFY_PHONE.test(query.phoneNumber)) {
        const message = 'หมายเลขโทรศัพท์ไม่ถูกต้อง'
        throw new GraphQLError(message, {
          extensions: {
            code: 'BAD_REQUEST',
            errors: [{ message }],
          },
        })
      }
      // Pagination
      const pagination: PaginateOptions = reformPaginate(paginate)

      const filterQuery: FilterQuery<OTPRequst> = {
        phoneNumber: query.phoneNumber,
      }

      const otps = (await OTPRequstModel.paginate(filterQuery, pagination)) as OTPPaginationPayload
      if (!otps) {
        const message = `ไม่พบข้อมูล OTP`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return otps
    } catch (error) {
      console.log('error: ', error)
      throw error
    }
  }
}
