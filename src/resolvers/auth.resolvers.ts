import { Resolver, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import { AuthPayload } from '@payloads/user.payloads'
import { generateAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import { GraphQLError } from 'graphql'
import { get, split } from 'lodash'
import SettingCustomerPoliciesModel from '@models/settingCustomerPolicies.model'
import SettingDriverPoliciesModel from '@models/settingDriverPolicies.model'
import { AuthGuard } from '@guards/auth.guards'
import { decryption } from '@utils/encryption'
import { PasswordChangeInput } from '@inputs/customer.input'
import { ChangePasswordSchema } from '@validations/customer.validations'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import bcrypt from "bcrypt";
import { email_sender } from '@utils/email.utils'

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
            let requireAcceptedPolicy = true
            if (user.userRole === 'customer') {
                const settingCustomerPolicies = await SettingCustomerPoliciesModel.find();
                const policyVersion = get(settingCustomerPolicies, '0.version', 0)
                if (user.acceptPolicyVersion >= policyVersion) {
                    requireAcceptedPolicy = false
                } else {
                    requireAcceptedPolicy = true
                }
            } else if (user.userRole === 'driver') {
                const settingDriverPolicies = await SettingDriverPoliciesModel.find();
                const policyVersion = get(settingDriverPolicies, '0.version', 0)
                if (user.acceptPolicyVersion >= policyVersion) {
                    requireAcceptedPolicy = false
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

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(["admin", "customer", 'driver']))
    async changePassword(
        @Arg("data") data: PasswordChangeInput,
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            const userId = ctx.req.user_id;
            if (userId) {
                const userModel = await UserModel.findById(userId);
                if (!userModel) {
                    const message =
                        "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
                    throw new GraphQLError(message, {
                        extensions: {
                            code: "NOT_FOUND",
                            errors: [{ message }],
                        },
                    });
                }

                // Prepare Email
                const emailTranspoter = email_sender();

                const password_decryption = decryption(data.password || '')
                const confirm_password_decryption = decryption(data.confirmPassword)
                await ChangePasswordSchema.validate({ password: password_decryption, confirmPassword: confirm_password_decryption }, { abortEarly: false })
                const hashedPassword = await bcrypt.hash(password_decryption, 10);
                await userModel.updateOne({ password: hashedPassword, isChangePasswordRequire: false })


                const email = userModel.userType === 'individual' ? get(userModel, 'individualDetail.email', '') : get(userModel, 'businessDetail.businessEmail', '')
                const movemate_link = `https://www.movematethailand.com`

                await emailTranspoter.sendMail({
                    from: process.env.NOREPLY_EMAIL,
                    to: email,
                    subject: "เปลี่ยนรหัสผ่านบัญชีสำเร็จ",
                    template: "passwordchanged",
                    context: { movemate_link },
                });

                return true;
            }
            const message =
                "ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน";
            throw new GraphQLError(message, {
                extensions: {
                    code: "NOT_FOUND",
                    errors: [{ message }],
                },
            });
        } catch (errors) {
            console.log("error: ", errors);
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors);
            }
            throw errors;
        }
    }
}
