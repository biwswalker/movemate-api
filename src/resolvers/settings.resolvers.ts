import { AuthGuard } from "@guards/auth.guards";
import { SettingContactUsInput } from "@inputs/settings.input";
import SettingContactUsModel, { SettingContactUs } from "@models/settingContactUs.model";
import { yupValidationThrow } from "@utils/error.utils";
import { GeneralSchema } from "@validations/settings.validations";
import { GraphQLError } from "graphql";
import { Arg, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { ValidationError } from "yup";

@Resolver()
export default class SettingsResolver {
    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateContactus(
        @Arg("data") data: SettingContactUsInput,
    ): Promise<boolean> {
        try {
            await GeneralSchema.validate(data, { abortEarly: false })

            const settingContactus = new SettingContactUsModel(data)
            await settingContactus.save()

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }

    @Query(() => SettingContactUs)
    async getContactusInfo(): Promise<SettingContactUs> {
        try {
            const settingContactUs = await SettingContactUsModel.find();
            if (!settingContactUs) {
                const message = `ไม่สามารถเรียกข้อมูลการติดต่อได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return settingContactUs[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลการติดต่อได้ โปรดลองอีกครั้ง");
        }
    }
}