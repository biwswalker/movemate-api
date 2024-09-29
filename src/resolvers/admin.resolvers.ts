import {
    Resolver,
    Mutation,
    Arg,
    Ctx,
    UseMiddleware,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import bcrypt from "bcrypt";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { generateId, getCurrentHost } from "@utils/string.utils";
import addEmailQueue from '@utils/email.utils'
import { GraphQLError } from 'graphql'
import AdminModel from "@models/admin.model";
import { AddAdminInput } from "@inputs/admin.input";

@Resolver(User)
export default class AdminResolver {

    @Mutation(() => User)
    @UseMiddleware(AuthGuard(['admin']))
    async addAdmin(
        @Arg("data") data: AddAdminInput,
        @Ctx() ctx: GraphQLContext
    ): Promise<User> {
        const { email, status } = data;
        try {
            // Exist email
            if (email) {
                const isExistingEmail = await AdminModel.findOne({ email })
                if (isExistingEmail) {
                    throw new GraphQLError('ไม่สามารถใช้อีเมลซ้ำ', {
                        extensions: {
                            code: 'ERROR_VALIDATION',
                            errors: [{ field: 'email', message: 'ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ' }],
                        }
                    })
                }
            } else {
                throw new GraphQLError('ระบุอีเมล', {
                    extensions: {
                        code: 'ERROR_VALIDATION',
                        errors: [{ field: 'email', message: 'ระบุอีเมล' }],
                    }
                })
            }

            const userNumber = await generateId("MMAM", 'admin');
            const userPassword = await generateId("ADMIN", 'password');
            const hashedPassword = await bcrypt.hash(userPassword, 10);
            const admin = new AdminModel({
                userNumber,
                ...data
            });

            await admin.save();

            const user = new UserModel({
                userRole: 'admin',
                userNumber,
                status,
                userType: 'individual',
                username: userNumber,
                password: hashedPassword,
                registration: 'web',
                isVerifiedEmail: false,
                isVerifiedPhoneNumber: false,
                acceptPolicyVersion: 99,
                acceptPolicyTime: new Date().toISOString(),
                adminDetail: admin,
            });

            await user.save();

            const host = getCurrentHost(ctx)
            const activate_link = `${host}/api/v1/activate/admin/${user.userNumber}`
            const movemate_link = `https://www.movematethailand.com`
            // Email sender
            await addEmailQueue({
                from: process.env.NOREPLY_EMAIL,
                to: email,
                subject: 'ยืนยันการเข้าร่วม Movemate!',
                template: 'register_admin',
                context: {
                    fullname: admin.fullname,
                    username: userNumber,
                    password: userPassword.toLowerCase(),
                    activate_link,
                    movemate_link,
                }
            })

            return user;
        } catch (error) {
            console.log(error)
            throw error
        }
    }
}
