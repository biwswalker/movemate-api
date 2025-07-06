import { Resolver, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import { get, includes, split } from 'lodash'
import SettingCustomerPoliciesModel from '@models/settingCustomerPolicies.model'
import SettingDriverPoliciesModel from '@models/settingDriverPolicies.model'
import { AuthGuard } from '@guards/auth.guards'
import { decryption } from '@utils/encryption'
import { PasswordChangeInput } from '@inputs/customer.input'
import { ChangePasswordSchema } from '@validations/customer.validations'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import bcrypt from 'bcrypt'
import addEmailQueue from '@utils/email.utils'
import { EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { AuditLogDecorator } from 'decorators/AuditLog.decorator'
import { EAuditActions } from '@enums/audit'
import { AuditLog } from '@models/auditLog.model'

@Resolver()
export default class AuthResolver {
  @Mutation(() => AuthPayload)
  async login(@Arg('username') username: string, @Ctx() ctx: GraphQLContext): Promise<AuthPayload> {
    try {
      const hashedPassword = get(split(get(ctx, 'req.headers.authorization', ''), ' '), '1', '')
      const user = await User.findByUsername(username, undefined)

      if (!user) {
        throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
      }

      if ((user.status === EUserStatus.PENDING || !user.isVerifiedEmail) && user.userRole === EUserRole.CUSTOMER) {
        const email =
          user.userType === EUserType.INDIVIDUAL
            ? get(user, 'individualDetail.email', '')
            : user.userType === EUserType.BUSINESS
            ? get(user, 'businessDetail.businessEmail', '')
            : ''
        await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
        const message = `บัญชี ${email} ยังไม่ได้ยืนยันอีเมล โปรดยืนยันอีเมลก่อน หากไม่ได้รับอีเมลโปรดติดต่อเจ้าหน้าที่`
        throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
      } else if (user.status === EUserStatus.INACTIVE) {
        // TODO: ยังสามารถใช้งานได้ปกติ
      } else if (user.status === EUserStatus.BANNED && user.userRole === EUserRole.CUSTOMER) {
        // TODO: สามารถ login ได้ แต่ แจ้งชำระ และ ดูประวัติงานเก่าได้
        await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
        const message = `บัญชีของท่านโดนระงับการใช้งานจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
        throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
      } else if (user.status === EUserStatus.DENIED && includes([EUserRole.ADMIN, EUserRole.CUSTOMER], user.userRole)) {
        await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
        const message = `บัญชีของท่านไม่ถูกอนุมัติ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
        throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
      }

      if (user.userRole === EUserRole.CUSTOMER && user.userType === EUserType.BUSINESS) {
        if (user.validationStatus === EUserValidationStatus.PENDING) {
          await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
          const message = `บัญชีของท่านยังไม่ได้การตอบรับจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
          throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
        } else if (user.validationStatus === EUserValidationStatus.DENIED) {
          await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
          const message = `บัญชีของท่านไม่ถูกอนุมัติ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
          throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
        }
      }

      if (user.userRole === EUserRole.ADMIN) {
        if (user.status !== EUserStatus.ACTIVE) {
          await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
          const message = `บัญชีของท่านถูกระงับการใช้งานจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
          throw new GraphQLError(message, { extensions: { code: 'BANNED_USER', message } })
        }
      }

      if (user.userRole === EUserRole.DRIVER) {
        if (user.status === EUserStatus.BANNED) {
          await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
          const message = `บัญชีของท่านถูกระงับการใช้งานจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
          throw new GraphQLError(message, { extensions: { code: 'BANNED_USER', message } })
        }
      }

      const validateResult = await user.validatePassword(hashedPassword)

      if (!validateResult) {
        await AuditLog.createLog(user._id, EAuditActions.LOGIN_FAILED, 'User', user._id, ctx.ip)
        throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
      }

      const token = generateAccessToken(user._id, user.userRole)
      ctx.res.cookie('access_token', token, { httpOnly: true })

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

      // Add audit Log
      await AuditLog.createLog(user._id, EAuditActions.LOGIN, 'User', user._id, ctx.ip)

      return {
        token,
        user,
        requireAcceptedPolicy,
        requirePasswordChange: user.isChangePasswordRequire,
      }
    } catch (error) {
      console.log('-------', error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(
    AuditLogDecorator({
      action: EAuditActions.LOGOUT,
      entityType: 'User',
      entityId: (root, args, context) => context.req.user_id,
      details: (root, args) => ({}), // No specific details needed for logout
    }),
  )
  async logout(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    // Clear access token by removing the cookie
    ctx.res.clearCookie('access_token')
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER, EUserRole.DRIVER]))
  @UseMiddleware(
    AuditLogDecorator({
      action: EAuditActions.CHANGE_PASSWORD,
      entityType: 'User',
      entityId: (root, args, context) => context.req.user_id,
      details: (root, args) => ({}), // Don't log the password itself
    }),
  )
  async changePassword(@Arg('data') data: PasswordChangeInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
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

        const password_decryption = decryption(data.password || '')
        const confirm_password_decryption = decryption(data.confirmPassword)
        await ChangePasswordSchema.validate(
          { password: password_decryption, confirmPassword: confirm_password_decryption },
          { abortEarly: false },
        )
        const hashedPassword = await bcrypt.hash(password_decryption, 10)
        await userModel.updateOne({ password: hashedPassword, isChangePasswordRequire: false })

        const email =
          userModel.userType === EUserType.INDIVIDUAL
            ? get(userModel, 'individualDetail.email', '')
            : get(userModel, 'businessDetail.businessEmail', '')
        const movemate_link = `https://www.movematethailand.com`

        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
          to: email,
          subject: 'เปลี่ยนรหัสผ่านบัญชีสำเร็จ',
          template: 'passwordchanged',
          context: { movemate_link },
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
}
