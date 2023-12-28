import { Resolver, Mutation, Arg, Ctx } from 'type-graphql'
import { AuthPayload, User } from '@models/user.model'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { isEmpty } from 'lodash'

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
                throw new Error('Invalid email or password')
            }

            const token = generateAccessToken(user._id, 'customer')
            ctx.res.cookie('access_token', token, { httpOnly: true })

            return {
                token,
                user
            }
        } catch (error) {
            console.log(error)
            throw new Error(error)
        }
    }

    @Mutation(() => Boolean)
    async logout(@Ctx() ctx: GraphQLContext): Promise<boolean> {
        // Clear access token by removing the cookie
        ctx.res.clearCookie('access_token');
        return true;
    }
}