import { Resolver, Mutation, Arg, Ctx } from 'type-graphql'
import { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import { get, split } from 'lodash'
import SettingCustomerPoliciesModel from '@models/settingCustomerPolicies.model'
import SettingDriverPoliciesModel from '@models/settingDriverPolicies.model'

@Resolver()
export default class AuthResolver {

    @Mutation(() => AuthPayload)
    async login(
        @Arg('username') username: string,
        @Ctx() ctx: GraphQLContext
    ): Promise<AuthPayload> {
        try {
            const hashedPassword = get(split(get(ctx, 'req.headers.authorization', ''), ' '), '1', '')
            const user = await User.findByUsername(username)

            if (!user) {
                throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
            }

            if (user.status === 'pending' || !user.isVerifiedEmail) {
                const email = user.userType === 'individual'
                    ? get(user, "individualDetail.email", '')
                    : user.userType === 'business'
                        ? get(user, 'businessDetail.businessEmail', '') : ''
                const message = `บัญชี ${email} ยังไม่ได้ยืนยันอีเมล โปรดยืนยันอีเมลก่อน หากไม่ได้รับอีเมลโปรดติดต่อเจ้าหน้าที่`
                throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
            } else if (user.status === 'inactive') {
                // TODO:
            } else if (user.status === 'banned') {
                const message = `บัญชีของท่านโดนระงับการใช้งานจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
                throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
            } else if (user.status === 'denied') {
                const message = `บัญชีของท่านไม่ถูกอนุมัติ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
                throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
            }

            if (user.userType === 'business') {
                if (user.validationStatus === 'pending') {
                    const message = `บัญชีของท่านยังไม่ได้การตอบรับจากผู้ดูแลระบบ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
                    throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
                } else if (user.validationStatus === 'denied') {
                    const message = `บัญชีของท่านไม่ถูกอนุมัติ โปรดติดต่อเจ้าหน้าที่หากมีข้อสงสัย`
                    throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
                }
            }

            const validateResult = await user.validatePassword(hashedPassword)

            if (!validateResult) {
                throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
            }

            const token = generateAccessToken(user._id, user.userRole)
            ctx.res.cookie('access_token', token, { httpOnly: true })

            // Check policy
            let requireAcceptedPolicy = false
            if (user.userRole === 'customer') {
                const settingCustomerPolicies = await SettingCustomerPoliciesModel.find();
                const policyVersion = get(settingCustomerPolicies, '0.version', 0)
                if (policyVersion > user.acceptPolicyVersion) {
                    requireAcceptedPolicy = true
                } else {
                    requireAcceptedPolicy = true
                }
            } else if (user.userRole === 'driver') {
                const settingDriverPolicies = await SettingDriverPoliciesModel.find();
                const policyVersion = get(settingDriverPolicies, '0.version', 0)
                if (policyVersion > user.acceptPolicyVersion) {
                    requireAcceptedPolicy = true
                } else {
                    requireAcceptedPolicy = true
                }
            }

            return {
                token,
                user,
                requireAcceptedPolicy,
                requirePasswordChange: user.isChangePasswordRequire,
            }
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    @Mutation(() => Boolean)
    async logout(@Ctx() ctx: GraphQLContext): Promise<boolean> {
        // Clear access token by removing the cookie
        ctx.res.clearCookie('access_token');
        return true;
    }
}
