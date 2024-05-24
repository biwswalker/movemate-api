import {
    Resolver,
    Query,
    Mutation,
    Arg,
    Ctx,
    UseMiddleware,
} from "type-graphql";
import UserModel, { User } from "@models/user.model";
import { UpdateUserInput } from "@inputs/user.input";
import bcrypt from "bcrypt";
import { AuthGuard } from "@guards/auth.guards";
import { GraphQLContext } from "@configs/graphQL.config";
import { generateId } from "@utils/string.utils";
import { email_sender } from "@utils/email.utils";
import imageToBase64 from 'image-to-base64'
import { join } from 'path'
import { SafeString } from 'handlebars'
import { GraphQLError } from 'graphql'
import { AdminPayload } from "@payloads/user.payloads";
import AdminModel, { Admin } from "@models/admin.model";
import { AddAdminInput } from "@inputs/admin.input";
import cryptoJs from "crypto-js";

@Resolver(Admin)
export default class AdminResolver {
    @Query(() => [User])
    @UseMiddleware(AuthGuard)
    async admins(): Promise<User[]> {
        try {
            const users = await UserModel.find({ userRole: 'admin' });
            return users;
        } catch (error) {
            throw new Error("Failed to fetch users");
        }
    }

    @Query(() => User)
    @UseMiddleware(AuthGuard)
    async admin(@Arg("id") id: string): Promise<User> {
        try {
            const user = await UserModel.findById(id);
            if (!user) {
                throw new Error("ไม่พบผู้ดูแล");
            }
            return user;
        } catch (error) {
            throw new Error("Failed to fetch user");
        }
    }

    @Mutation(() => AdminPayload)
    async addAdmin(
        @Arg("data") data: AddAdminInput,
        @Ctx() ctx: GraphQLContext
    ): Promise<AdminPayload> {
        const { email } = data;
        try {
            // Prepare email sender
            const emailTranspoter = email_sender()
            // Conver image path to base64 image
            const base64Image = await imageToBase64(join(__dirname, '..', 'assets', 'email_logo.png'))
            const imageUrl = new SafeString(`data:image/png;base64,${base64Image}`)
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
            const encryptionPassword = cryptoJs.AES.encrypt(
                userPassword,
                process.env.MOVEMATE_SHARED_KEY
            ).toString();
            const hashedPassword = await bcrypt.hash(encryptionPassword, 10);
            const user = new UserModel({
                userRole: 'admin',
                userNumber,
                userType: 'individual',
                username: userNumber,
                password: hashedPassword,
                registration: 'web',
                isVerifiedEmail: false,
                isVerifiedPhoneNumber: false,
                acceptPolicyVersion: 99,
                acceptPolicyTime: new Date().toISOString(),
            });
            const admin = new AdminModel({
                userNumber,
                ...data
            });

            await user.save();
            await admin.save();
            // Email sender
            await emailTranspoter.sendMail({
                from: process.env.GOOGLE_MAIL,
                to: email,
                subject: 'ยืนยันการเข้าร่วม Movemate!',
                template: 'register_admin',
                context: {
                    fullname: admin.fullName,
                    username: userNumber,
                    password: userPassword,
                    logo: imageUrl,
                    activateLink: `https://api.movemateth.com/activate/admin/${userNumber}`,
                    movemateLink: `https://www.movemateth.com`,
                }
            })

            return { user, adminDetail: admin };
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    @Mutation(() => User)
    @UseMiddleware(AuthGuard)
    async updateUser(
        @Arg("data") { id, ...update_data }: UpdateUserInput
    ): Promise<User> {
        try {
            const user = await UserModel.findByIdAndUpdate(id, update_data, {
                new: true,
            });
            if (!user) {
                throw new Error("User not found");
            }

            return user;
        } catch (error) {
            throw new Error("Failed to update user");
        }
    }
}
