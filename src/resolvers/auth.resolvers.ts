import { Resolver, Mutation, Arg, Ctx } from 'type-graphql'
import { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import IndividualCustomerModel from '@models/customerIndividual.model'
import BusinessCustomerModel from '@models/customerBusiness.model'

@Resolver()
export default class AuthResolver {

    @Mutation(() => AuthPayload)
    async login(
        @Arg('username') username: string,
        @Arg('password') password: string,
        @Ctx() ctx: GraphQLContext
    ): Promise<AuthPayload> {
        try {
            const user = await User.findByUsername(username)

            if (!user || !user.validatePassword(password)) {
                throw new GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง')
            }

            const token = generateAccessToken(user._id)
            ctx.res.cookie('access_token', token, { httpOnly: true })

            if (user.userType === 'individual') {
                const individualDetail = await IndividualCustomerModel.findByUserNumber(user.userNumber)
                return {
                    token,
                    detail: {
                        user,
                        individualDetail
                    },
                }
            } else if (user.userType === 'business') {
                const businessDetail = await BusinessCustomerModel.findByUserNumber(user.userNumber)
                return {
                    token,
                    detail: {
                        user,
                        businessDetail
                    },
                }
            }
            return {
                token,
                detail: {
                    user,
                },
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
