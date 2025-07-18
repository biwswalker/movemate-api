import { Resolver, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import bcrypt from 'bcrypt'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { generateId, generateRandomNumberPattern, getCurrentHost } from '@utils/string.utils'
import addEmailQueue from '@utils/email.utils'
import { GraphQLError } from 'graphql'
import AdminModel from '@models/admin.model'
import { AddAdminInput } from '@inputs/admin.input'
import { generateExpToken } from '@utils/encryption'
import { ERegistration, EUserRole, EUserType } from '@enums/users'

@Resolver(User)
export default class AdminResolver {
  @Mutation(() => User)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async addAdmin(@Arg('data') data: AddAdminInput, @Ctx() ctx: GraphQLContext): Promise<User> {
    const { email, status } = data
    try {
      // Exist email
      if (email) {
        const isExistingEmail = await AdminModel.findOne({ email })
        if (isExistingEmail) {
          throw new GraphQLError('ไม่สามารถใช้อีเมลซ้ำ', {
            extensions: {
              code: 'ERROR_VALIDATION',
              errors: [
                { field: 'email', message: 'ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ' },
              ],
            },
          })
        }
      } else {
        throw new GraphQLError('ระบุอีเมล', {
          extensions: {
            code: 'ERROR_VALIDATION',
            errors: [{ field: 'email', message: 'ระบุอีเมล' }],
          },
        })
      }

      const userNumber = await generateId('MMAM', 'admin')
      const rawPassword = generateRandomNumberPattern('MMPWD########').toLowerCase()
      const hashedPassword = await bcrypt.hash(rawPassword, 10)
      const admin = new AdminModel({
        userNumber,
        ...data,
      })

      await admin.save()

      const user = new UserModel({
        userRole: EUserRole.ADMIN,
        userNumber,
        status,
        userType: EUserType.INDIVIDUAL,
        username: userNumber,
        password: hashedPassword,
        registration: ERegistration.WEB,
        isVerifiedEmail: false,
        isVerifiedPhoneNumber: false,
        acceptPolicyVersion: 99,
        acceptPolicyTime: new Date().toISOString(),
        adminDetail: admin,
      })

      await user.save()

      const host = getCurrentHost(ctx)
      const userNumberToken = generateExpToken({ userNumber: user.userNumber })
      const activate_link = `${host}/api/v1/activate/admin/${userNumberToken}`
      const movemate_link = `https://www.movematethailand.com`
      // Email sender
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: email,
        subject: 'ยืนยันการเข้าร่วม Movemate!',
        template: 'register_admin',
        context: {
          fullname: admin.fullname,
          username: userNumber,
          password: rawPassword,
          activate_link,
          movemate_link,
        },
      })

      return user
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}
