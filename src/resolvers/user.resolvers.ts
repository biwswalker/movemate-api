import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import { RegisterInput } from '@inputs/user.input'
import bcrypt from 'bcrypt'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { isEmpty } from 'lodash'
import { generateId } from '@utils/string.utils'

@Resolver(User)
export default class UserResolver {
    @Query(() => [User])
    @UseMiddleware(AuthGuard)
    async users(): Promise<User[]> {
        try {
            const users = await UserModel.find()
            return users
        } catch (error) {
            throw new Error('Failed to fetch users')
        }
    }

    @Query(() => User)
    @UseMiddleware(AuthGuard)
    async user(@Arg('id') id: string): Promise<User> {
        try {
            const user = await UserModel.findById(id)
            if (!user) {
                throw new Error('User not found')
            }
            return user
        } catch (error) {
            throw new Error('Failed to fetch user')
        }
    }

    @Query(() => User)
    @UseMiddleware(AuthGuard)
    async me(@Ctx() ctx: GraphQLContext): Promise<User> {
        try {
            const userId = ctx.req.user_id
            if (!userId) {
                throw new Error('User not found')
            }
            const user = await UserModel.findById(userId)
            if (!user) {
                throw new Error('User not found')
            }
            return user
        } catch (error) {
            throw new Error('Failed to fetch user')
        }
    }

    @Mutation(() => User)
    async register(@Arg('data') data: RegisterInput, @Ctx() ctx: GraphQLContext): Promise<User> {
        const { username,
            email,
            password,
            user_type,
            // Step 2
            ...otherRegisterData
        } = data

        try {
            // Check if the user already exists
            const platform = ctx.req.headers['platform']
            if (isEmpty(platform)) {
                throw new Error('Bad Request: Platform is require')
            }

            const existingUser = await UserModel.findOne({ email })
            if (existingUser) {
                throw new Error('User already exists')
            }

            // TODO: 
            const number_prefix = user_type === 'business' ? 'BU' : 'CU'
            const user_number = await generateId(number_prefix, user_type)
            const invite_code = await generateId('INV', 'invite')
            const status = 'active'
            const credit_limit = 20000 // Get default credit limit from config

            const hashedPassword = await bcrypt.hash(password, 10)
            const user = new UserModel({
                user_number,
                email,
                password: hashedPassword,
                username,
                user_type,
                registration: platform,
                invite_code,
                status,
                credit_limit,
                // Other register data
                ...otherRegisterData
            })
            await user.save()

            return user
        } catch (error) {
            throw new Error(error)
        }
    }

    @Mutation(() => User)
    @UseMiddleware(AuthGuard)
    async updateUser(@Arg('data') { id, ...update_data }: UpdateUserInput): Promise<User> {
        try {
            const user = await UserModel.findByIdAndUpdate(id, update_data, { new: true })
            if (!user) {
                throw new Error('User not found')
            }

            return user
        } catch (error) {
            throw new Error('Failed to update user')
        }
    }
}