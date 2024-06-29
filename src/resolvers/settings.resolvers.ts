import { GraphQLContext } from "@configs/graphQL.config";
import { AuthGuard } from "@guards/auth.guards";
import { SettingBusinessTypeInput, SettingContactUsInput, SettingFAQInput, SettingInstructionInput } from "@inputs/settings.input";
import SettingAboutusModel, { SettingAboutus } from "@models/settingAboutus.mode";
import SettingBusinessTypeModel, { SettingBusinessType } from "@models/settingBusinessType.model";
import SettingContactUsModel, { SettingContactUs } from "@models/settingContactUs.model";
import SettingCustomerPoliciesModel, { SettingCustomerPolicies } from "@models/settingCustomerPolicies.model";
import SettingDriverPoliciesModel, { SettingDriverPolicies } from "@models/settingDriverPolicies.model";
import SettingFAQModel, { SettingFAQ } from "@models/settingFAQ.model";
import SettingInstructionModel, { SettingInstruction } from "@models/settingInstruction.model";
import UpdateHistoryModel from "@models/updateHistory.model";
import { yupValidationThrow } from "@utils/error.utils";
import { BusinessTypesSchema, FAQsSchema, GeneralSchema, InstructionsSchema } from "@validations/settings.validations";
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

    @Query(() => SettingContactUs, { nullable: true })
    async getContactusInfo(): Promise<SettingContactUs> {
        try {
            const settingContactUs = await SettingContactUsModel.find();
            if (!settingContactUs) {
                return null
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


    @Query(() => SettingAboutus, { nullable: true })
    async getAboutusInfo(): Promise<SettingAboutus> {
        try {
            const settingAboutus = await SettingAboutusModel.find();
            if (!settingAboutus) {
                return null
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

            const newVersion = settingCustomerPoliciesOldData.version ? settingCustomerPoliciesOldData.version + 1 : 1
            const _id = settingCustomerPoliciesOldData ? settingCustomerPoliciesOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingCustomerPolicies",
                who: userId,
                beforeUpdate: settingCustomerPoliciesOldData ? omit(settingCustomerPoliciesOldData.toObject(), ['history']) : {},
                afterUpdate: { customerPolicies: data, version: newVersion },
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: { customerPolicies: data, version: newVersion },
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

            const newVersion = settingDriverPoliciesOldData.version ? settingDriverPoliciesOldData.version + 1 : 1
            const _id = settingDriverPoliciesOldData ? settingDriverPoliciesOldData._id : new Types.ObjectId()

            const updateHistory = new UpdateHistoryModel({
                referenceId: _id.toString(),
                referenceType: "SettingDriverPolicies",
                who: userId,
                beforeUpdate: settingDriverPoliciesOldData ? omit(settingDriverPoliciesOldData.toObject(), ['history']) : {},
                afterUpdate: { driverPolicies: data, version: newVersion },
            });

            const updateData = [{
                updateOne: {
                    filter: { _id },
                    update: {
                        $set: { driverPolicies: data, version: newVersion },
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
    async getBusinessTypeInfo(@Arg("includeOther", { nullable: true }) oncludeOther: boolean = false): Promise<SettingBusinessType[]> {
        try {
            const currentDate = new Date()
            const other: SettingBusinessType = { _id: '', available: true, name: 'อื่นๆ', createdAt: currentDate, updatedAt: currentDate, history: [] }
            const settingBusinessTypes = await SettingBusinessTypeModel.findAvailable()
            if (!settingBusinessTypes) {
                return [...(oncludeOther ? [other] : [])]
            }
            return [...settingBusinessTypes, ...(oncludeOther ? [other] : [])];
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลประเภทธุรกิจได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateFAQ(
        @Arg("data", () => [SettingFAQInput]) data: SettingFAQInput[],
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            await FAQsSchema.validate({ faqs: data })

            const userId = ctx.req.user_id;

            await SettingFAQModel.bulkUpsertAndMarkUnused(data, userId)

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }

    @Query(() => [SettingFAQ])
    async getFAQInfo(): Promise<SettingFAQ[]> {
        try {
            const settingFAQs = await SettingFAQModel.find()
            if (!settingFAQs) {
                return []
            }
            return settingFAQs;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลคำถามที่พบบ่อยได้ โปรดลองอีกครั้ง");
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(AuthGuard(['admin']))
    async updateInstruction(
        @Arg("data", () => [SettingInstructionInput]) data: SettingInstructionInput[],
        @Ctx() ctx: GraphQLContext
    ): Promise<boolean> {
        try {
            await InstructionsSchema.validate({ instructions: data })

            const userId = ctx.req.user_id;

            await SettingInstructionModel.bulkUpsertAndMarkUnused(data, userId)

            return true
        } catch (errors) {
            console.log('error: ', errors)
            if (errors instanceof ValidationError) {
                throw yupValidationThrow(errors)
            }
            throw errors
        }
    }

    @Query(() => [SettingInstruction])
    async getInstructionInfo(): Promise<SettingInstruction[]> {
        try {
            const settingInstruction = await SettingInstructionModel.find()
            if (!settingInstruction) {
                return []
            }
            return settingInstruction;
        } catch (error) {
            console.log('error: ', error)
            throw new GraphQLError("ไม่สามารถเรียกข้อมูลคำแนะนำได้ โปรดลองอีกครั้ง");
        }
    }
}