import { Resolver, Mutation, UseMiddleware, Ctx } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import UserModel from '@models/user.model'
import { GraphQLError } from 'graphql'
import { IndividualCustomer } from '@models/customerIndividual.model'
import { email_sender } from '@utils/email.utils'
import imageToBase64 from 'image-to-base64'
import { join } from 'path'
import { SafeString } from 'handlebars'
import { generateOTP, generateRef, getCurrentHost } from '@utils/string.utils'
import { addMinutes } from 'date-fns'
import { VerifyPayload } from '@payloads/verify.payloads'

@Resolver()
export default class VerifyAccountResolver {

    @Mutation(() => VerifyPayload)
    @UseMiddleware(AuthGuard(['customer', 'admin']))
    async resentEmail(@Ctx() ctx: GraphQLContext): Promise<VerifyPayload> {
        const userId = ctx.req.user_id
        try {
            const user = await UserModel.findById(userId)

            if (!user) {
                const message =
                    "ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
                throw new GraphQLError(message, {
                    extensions: {
                        code: "NOT_FOUND",
                        errors: [{ message }],
                    },
                });
            }

            const emailTranspoter = email_sender();
            // Conver image path to base64 image
            const base64Image = await imageToBase64(join(__dirname, '..', 'assets', 'email_logo.png'))
            const imageUrl = new SafeString(`data:image/png;base64,${base64Image}`)

            const host = getCurrentHost(ctx)
            const activate_link = `${host}/api/v1/activate/customer/${user.userNumber}`
            const movemate_link = `https://www.movematethailand.com`

            if (user.userType === 'individual' && user.individualDetail) {
                const individualDetail = user.individualDetail as IndividualCustomer
                const email = individualDetail.email

                await emailTranspoter.sendMail({
                    from: process.env.NOREPLY_EMAIL,
                    to: email,
                    subject: "ยืนยันอีเมล Movemate!",
                    template: "confirm_email",
                    context: {
                        fullname: individualDetail.fullname,
                        username: email,
                        logo: imageUrl,
                        activate_link,
                        movemate_link,
                    },
                });
            }

            const currentDate = new Date()
            const countdown = addMinutes(currentDate, 1)
            const duration = `1m`

            return {
                countdown,
                duration
            }
        } catch (error) {
            console.log('errorr', error)
            throw error;
        }
    }

    @Mutation(() => VerifyPayload)
    @UseMiddleware(AuthGuard(['customer', 'admin']))
    async resentOTP(@Ctx() ctx: GraphQLContext): Promise<VerifyPayload> {
        const userId = ctx.req.user_id
        try {
            const user = await UserModel.findById(userId)

            if (!user) {
                const message =
                    "ไม่สามารถเรียกข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน";
                throw new GraphQLError(message, {
                    extensions: {
                        code: "NOT_FOUND",
                        errors: [{ message }],
                    },
                });
            }

            const endTime = new Date(user.lastestOTPTime).getTime()
            if (Date.now() < endTime) {
                const message =
                    "ไม่สามารถส่ง OTP ได้ในขนะนี้ กรุณาลองใหม่";
                throw new GraphQLError(message, {
                    extensions: {
                        code: "NOT_FOUND",
                        errors: [{ message }],
                    },
                });
            }

            const ref = generateRef()
            const otp = generateOTP()

            const verifyLast = `${otp} คือ รหัสยืนยันเบอร์ติดต่อ MovemateTH ของคุณ (Ref:${ref})`

            const currentDate = new Date()
            const countdown = addMinutes(currentDate, 2)
            const duration = `2m`

            await user.updateOne({ lastestOTP: otp, lastestOTPRef: ref, lastestOTPTime: countdown })

            return {
                countdown,
                duration
            }
        } catch (error) {
            throw error;
        }
    }
}
