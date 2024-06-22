import { GraphQLContext } from "@configs/graphQL.config";
import { AuthGuard } from "@guards/auth.guards";
import { SettingBusinessTypeInput, SettingContactUsInput } from "@inputs/settings.input";
import SettingAboutusModel, { SettingAboutus } from "@models/settingAboutus.mode";
import SettingBusinessTypeModel, { SettingBusinessType } from "@models/settingBusinessType.model";
import SettingContactUsModel, { SettingContactUs } from "@models/settingContactUs.model";
import SettingCustomerPoliciesModel, { SettingCustomerPolicies } from "@models/settingCustomerPolicies.model";
import SettingDriverPoliciesModel, { SettingDriverPolicies } from "@models/settingDriverPolicies.model";
import UpdateHistoryModel from "@models/updateHistory.model";
import { yupValidationThrow } from "@utils/error.utils";
import { BusinessTypesSchema, GeneralSchema } from "@validations/settings.validations";
import { GraphQLError } from "graphql";
import { omit } from "lodash";
import { Types } from "mongoose";
import { Arg, Ctx, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { ValidationError } from "yup";

@Resolver()
export default class SettingsResolver {
    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateContactus(
        @Arg("data") data: SettingContactUsInput,
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            await GeneralSchema.validate(data, { abortEarly: false })

            const userId = ctx.req.user_id;
            const settingContactUs = await SettingContactUsModel.find();
            const settingContactUsOldData = settingContactUs[0]

            const _id = settingContactUsOldData ? settingContactUsOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingContactUs",
                who: userId,
                beforeUpdate: settingContactUsOldData ? omit(settingContactUsOldData.toObject(), ['history']) : {},
                afterUpdate: data,
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: data,
                        $push: { history: updateHistory },
                    },
                    upsert: true,
                },
            }]

            await SettingContactUsModel.bulkWrite(updateData);
            await updateHistory.save()

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

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateAboutus(
        @Arg("data") data: string,
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            const userId = ctx.req.user_id;
            const settingAboutus = await SettingAboutusModel.find();
            const settingAboutusOldData = settingAboutus[0]

            const _id = settingAboutusOldData ? settingAboutusOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingAboutus",
                who: userId,
                beforeUpdate: settingAboutusOldData ? omit(settingAboutusOldData.toObject(), ['history']) : {},
                afterUpdate: { instructiontext: data },
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: { instructiontext: data },
                        $push: { history: updateHistory },
                    },
                    upsert: true,
                },
            }]

            await SettingAboutusModel.bulkWrite(updateData);
            await updateHistory.save()

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }


    @Query(() => SettingAboutus)
    async getAboutusInfo(): Promise<SettingAboutus> {
        try {
            const settingAboutus = await SettingAboutusModel.find();
            if (!settingAboutus) {
                const message = `ไม่สามารถเรียกข้อมูลเกี่ยวกับได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return settingAboutus[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลเกี่ยวกับได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateCustomerPolicies(
        @Arg("data") data: string,
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            const userId = ctx.req.user_id;
            const settingCustomerPolicies = await SettingCustomerPoliciesModel.find();
            const settingCustomerPoliciesOldData = settingCustomerPolicies[0]

            const _id = settingCustomerPoliciesOldData ? settingCustomerPoliciesOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingCustomerPolicies",
                who: userId,
                beforeUpdate: settingCustomerPoliciesOldData ? omit(settingCustomerPoliciesOldData.toObject(), ['history']) : {},
                afterUpdate: { customerPolicies: data },
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: { customerPolicies: data },
                        $push: { history: updateHistory },
                    },
                    upsert: true,
                },
            }]

            await SettingCustomerPoliciesModel.bulkWrite(updateData);
            await updateHistory.save()

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }


    @Query(() => SettingCustomerPolicies)
    async getCustomerPoliciesInfo(): Promise<SettingCustomerPolicies> {
        try {
            const settingCustomerPolicies = await SettingCustomerPoliciesModel.find();
            if (!settingCustomerPolicies) {
                const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return settingCustomerPolicies[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateDriverPolicies(
        @Arg("data") data: string,
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            const userId = ctx.req.user_id;
            const settingDriverPolicies = await SettingDriverPoliciesModel.find();
            const settingDriverPoliciesOldData = settingDriverPolicies[0]

            const _id = settingDriverPoliciesOldData ? settingDriverPoliciesOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingDriverPolicies",
                who: userId,
                beforeUpdate: settingDriverPoliciesOldData ? omit(settingDriverPoliciesOldData.toObject(), ['history']) : {},
                afterUpdate: { driverPolicies: data },
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: { driverPolicies: data },
                        $push: { history: updateHistory },
                    },
                    upsert: true,
                },
            }]

            await SettingDriverPoliciesModel.bulkWrite(updateData);
            await updateHistory.save()

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }


    @Query(() => SettingDriverPolicies)
    async getDriverPoliciesInfo(): Promise<SettingDriverPolicies> {
        try {
            const settingDriverPolicies = await SettingDriverPoliciesModel.find();
            if (!settingDriverPolicies) {
                const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return settingDriverPolicies[0];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateBusinessType(
        @Arg("data", () => [SettingBusinessTypeInput]) data: SettingBusinessTypeInput[],
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            await BusinessTypesSchema.validate({ businessTypes: data })

            const userId = ctx.req.user_id;

            await SettingBusinessTypeModel.bulkUpsertAndMarkUnused(data, userId)

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }

    @Query(() => [SettingBusinessType])
    async getBusinessTypeInfo(): Promise<SettingBusinessType[]> {
        try {
            const settingBusinessTypes = await SettingBusinessTypeModel.findAvailable()
            if (!settingBusinessTypes) {
                const message = `ไม่สามารถเรียกข้อมูลประเภทธุรกิจได้`;
                throw new GraphQLError(message, {
                    extensions: { code: "NOT_FOUND", errors: [{ message }] },
                });
            }
            return settingBusinessTypes;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทธุรกิจได้ โปรดลองอีกครั้ง");
        }
    }
}