import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { USERS } from '@configs/pubsub'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import UserModel from '@models/user.model'
import { generateRandomNumberPattern } from '@utils/string.utils'
import { GraphQLError } from 'graphql'
import { Arg, Ctx, Mutation, Resolver, Root, SubscribeResolverData, Subscription, UseMiddleware } from 'type-graphql'
import bcrypt from 'bcrypt'
import addEmailQueue from '@utils/email.utils'
import { AuditLog } from '@models/auditLog.model'
import { EAuditActions } from '@enums/audit'

@Resolver()
export class ControllSubscriptionResolver {
  @Subscription({
    topics: USERS.FORCE_LOGOUT,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  forceLogout(@Root() payload: string, @Ctx() _: AuthContext): string {
    return payload
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async adminResetPassword(@Arg('userId') userId: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    const adminId = ctx.req.user_id
    try {
      const user = await UserModel.findById(userId)

      if (!user) {
        throw new GraphQLError('ไม่พบผู้ใช้งาน', { extensions: { code: 'NOT_FOUND' } })
      }

      // ตรวจสอบว่าเป็น Customer หรือไม่
      if (user.userRole !== EUserRole.CUSTOMER) {
        throw new GraphQLError('สามารถรีเซ็ตรหัสผ่านได้เฉพาะลูกค้าเท่านั้น')
      }

      const newPassword = generateRandomNumberPattern('MMPWD########').toLowerCase()
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      await UserModel.findByIdAndUpdate(userId, {
        password: hashedPassword,
        isChangePasswordRequire: true, // บังคับให้ผู้ใช้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งถัดไป
      })

      // ส่งอีเมลแจ้งผู้ใช้
      const email = user.email
      const movemate_link = 'https://www.movematethailand.com'
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: email,
        subject: 'รหัสผ่านของคุณถูกรีเซ็ตโดยผู้ดูแลระบบ',
        template: 'admin_reset_password', // ต้องสร้าง template นี้
        context: {
          fullname: user.fullname,
          username: user.username,
          password: newPassword,
          movemate_link,
        },
      })

      // Log การกระทำของ Admin
      await AuditLog.createLog(adminId, EAuditActions.RESET_PASSWORD, 'User', userId, ctx.ip)

      return true
    } catch (error) {
      console.error(error)
      throw new GraphQLError('เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน')
    }
  }
}
