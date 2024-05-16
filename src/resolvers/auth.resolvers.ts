import { Resolver, Mutation, Arg, Ctx } from 'type-graphql'
import { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'

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

// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjY0NTliNDZhMWM1ZjdlYTg1NzA4OTkxIiwiaWF0IjoxNzE1ODQwNzQ3LCJleHAiOjE3MTU5MjcxNDd9.mJ5XmBrpvXaomjak6V4Mlkl4KgKVhiFUpt8sUD8hhWM"
// "U2FsdGVkX1/evApjV6QwWfyV2zLA9XPL0L32PehFMqPK9AmhwRKNe7GXb9HFRsnQJkQluLGg3/e8ghgwOZ+d5Ig3ohEC2Yz9nU+YgrUjEQpMSl/Ew76HlpJvwqZnm2rbgRzG+KyRvUskP5CJboTRoKzA8mUNnpgAYiTp0qyUiTS6Ch/xvCfi7MkkwPrb5s18cYqZMi8FQn5OjbrrxC91O8kJHcgbT+hKkp8d4HeUdgMoOynSTtd4bHLNDE3BR2jN1jcLbWrbYlFUt7eo71ejjA=="

// "U2FsdGVkX1/evApjV6QwWfyV2zLA9XPL0L32PehFMqPK9AmhwRKNe7GXb9HFRsnQJkQluLGg3/e8ghgwOZ+d5Ig3ohEC2Yz9nU+YgrUjEQpMSl/Ew76HlpJvwqZnm2rbgRzG+KyRvUskP5CJboTRoKzA8mUNnpgAYiTp0qyUiTS6Ch/xvCfi7MkkwPrb5s18cYqZMi8FQn5OjbrrxC91O8kJHcgbT+hKkp8d4HeUdgMoOynSTtd4bHLNDE3BR2jN1jcLbWrbYlFUt7eo71ejjA=="
// 65794a68624763694f694a49557a49314e694973496e523563434936496b705856434a392e65794a316332567958326c6b496a6f694e6a59304e546c694e445a684d574d315a6a646c595467314e7a41344f546b784969776961574630496a6f784e7a45314f4451774e7a51334c434a6c654841694f6a45334d5455354d6a63784e4464392e6d4a35586d4272707658616f6d6a616b3656344d6c6b6c344b674b5668694655707438735544386868574d