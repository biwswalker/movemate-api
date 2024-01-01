import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware, FieldResolver, Root } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import UserIndividualModel, { IndividualUser } from '@models/user_individual.model'
import UserBusinessModel, { BusinessUser } from '@models/user_business.model'
import { RegisterInput, UpdateUserInput } from '@inputs/user.input'
import bcrypt from 'bcrypt'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { get, isEmpty } from 'lodash'
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
            console.log(user)
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
        const {
            email,
            password,
            user_type,
            accept_policy_time,
            accept_policy_version,
            ...other_input
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

            const number_prefix = user_type === 'business' ? 'BU' : 'CU'
            const user_number = await generateId(number_prefix, user_type)
            const user_role: TUserRole = 'customer'
            const status: TUserStatus = 'active'
            const validation_status: TUserValidationStatus = 'validating'

            let user_detail = null
            switch (user_type) {
                case 'individual':
                    user_detail = new UserIndividualModel({
                        user_number,
                        email,
                        title: other_input.title,
                        firstname: other_input.firstname,
                        lastname: other_input.lastname,
                        phone_numbers: other_input.phone_numbers,
                        identity_id: other_input.identity_id,
                        address: other_input.address,
                        branch: other_input.branch,
                        country: other_input.country,
                        province: other_input.province,
                        district: other_input.district,
                        sub_district: other_input.sub_district,
                        postcode: other_input.postcode,
                    })
                    await user_detail.save()
                    break;
                case 'business':
                    user_detail = new UserBusinessModel({
                        user_number,
                        email,
                        corporate_titles: other_input.corporate_titles,
                        corporate_name: other_input.corporate_name,
                        tax_id: other_input.tax_id,
                        corporate_branch: other_input.corporate_branch,
                        address: other_input.address,
                        country: other_input.country,
                        postcode: other_input.postcode,
                        province: other_input.province,
                        district: other_input.district,
                        sub_district: other_input.sub_district,
                        business_type: other_input.business_type,
                        business_type_other: other_input.business_type_other,
                        phone_numbers: other_input.phone_numbers,
                        document_business_register_certification: other_input.document_business_register_certification,
                        document_value_added_tax_registration_certification: other_input.document_value_added_tax_registration_certification,
                        document_copy_authorized_signatory_ID_card: other_input.document_copy_authorized_signatory_ID_card,
                    })
                    await user_detail.save()
                    break;
            }

            const hashedPassword = await bcrypt.hash(password, 10)
            const user = new UserModel({
                user_number,
                user_type,
                username: email,
                password: hashedPassword,
                status,
                user_role,
                validation_status,
                registration: platform,
                is_verified_email: false,
                is_verified_phone_number: false,
                accept_policy_version,
                accept_policy_time,
                ...(user_type === 'business' ? { business_detail: user_detail } : { individual_detail: user_detail })
            })

            await user.save()

            console.log('user', user)


            // TODO: user detail

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

    @FieldResolver(() => IndividualUser)
    async individual_detail(@Root() user: User): Promise<IndividualUser | null> {
        try {
            const user_detail_id = get(user, '_doc.individual_detail', '') || get(user, 'individual_detail', '')
            const user_detail = await UserIndividualModel.findById(user_detail_id)
            if (!user_detail) { return null }
            return user_detail
        } catch (error) {
            console.error('Error get customer:', error);
            return null;
        }
    }

    @FieldResolver(() => BusinessUser)
    async business_detail(@Root() user: User): Promise<BusinessUser | null> {
        try {
            const user_detail_id = get(user, '_doc.business_detail', '') || get(user, 'business_detail', '')
            const user_detail = await UserBusinessModel.findById(user_detail_id)
            if (!user_detail) { return null }
            return user_detail
        } catch (error) {
            console.error('Error get customer:', error);
            return null;
        }
    }
} IndividualUser
BusinessUser