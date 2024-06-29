import { Resolver, Mutation, Arg, Ctx } from 'type-graphql'
import { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import { get, split } from 'lodash'

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

            if (user.status === 'pending' && !user.isVerifiedEmail) {
                const email = user.userType === 'individual'
                    ? get(user, "individualDetail.email", '')
                    : user.userType === 'business'
                        ? get(user, 'businessDetail.businessEmail', '') : ''
                const message = `บัญชี ${email} ยังไม่ได้ยืนยันอีเมล โปรดยืนยันอีเมลก่อน หากไม่ได้รับอีเมลโปรดติดต่อเจ้าหน้าที่`
                throw new GraphQLError(message, { extensions: { code: 'VERIFY_EMAIL_REQUIRE', message } })
            }

            const validateResult = await user.validatePassword(hashedPassword)

            if (!validateResult) {
                throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
            }

            const token = generateAccessToken(user._id, user.userRole)
            ctx.res.cookie('access_token', token, { httpOnly: true })

            return {
                token,
                user
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
