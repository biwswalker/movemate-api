import { GraphQLContext } from '@configs/graphQL.config'
import { EAdminPermission, EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import {
  SettingBusinessTypeInput,
  SettingContactUsInput,
  SettingFAQInput,
  SettingFinancialInput,
  SettingInstructionInput,
} from '@inputs/settings.input'
import { Admin } from '@models/admin.model'
import SettingAboutusModel, { SettingAboutus } from '@models/settingAboutus.mode'
import SettingBusinessTypeModel, { SettingBusinessType } from '@models/settingBusinessType.model'
import SettingContactUsModel, { SettingContactUs } from '@models/settingContactUs.model'
import SettingCustomerPoliciesModel, { SettingCustomerPolicies } from '@models/settingCustomerPolicies.model'
import SettingCustomerTermsModel, { SettingCustomerTerms } from '@models/settingCustomerTerms.model'
import SettingDriverPoliciesModel, { SettingDriverPolicies } from '@models/settingDriverPolicies.model'
import SettingDriverTermsModel, { SettingDriverTerms } from '@models/settingDriverTerms.model'
import SettingFAQModel, { SettingFAQ } from '@models/settingFAQ.model'
import SettingFinancialModel, { SettingFinancial } from '@models/settingFinancial.model'
import SettingInstructionModel, { SettingInstruction } from '@models/settingInstruction.model'
import UpdateHistoryModel from '@models/updateHistory.model'
import UserModel from '@models/user.model'
import { yupValidationThrow } from '@utils/error.utils'
import { BusinessTypesSchema, FAQsSchema, GeneralSchema, InstructionsSchema } from '@validations/settings.validations'
import { GraphQLError } from 'graphql'
import { get, omit } from 'lodash'
import { Types } from 'mongoose'
import { Arg, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver()
export default class SettingsResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateContactus(@Arg('data') data: SettingContactUsInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      await GeneralSchema.validate(data, { abortEarly: false })

      const userId = ctx.req.user_id
      const settingContactUs = await SettingContactUsModel.find()
      const settingContactUsOldData = settingContactUs[0]

      const _id = settingContactUsOldData ? settingContactUsOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingContactUs',
        who: userId,
        beforeUpdate: settingContactUsOldData ? omit(settingContactUsOldData.toObject(), ['history']) : {},
        afterUpdate: data,
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: data,
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingContactUsModel.bulkWrite(updateData)
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
      const settingContactUs = await SettingContactUsModel.find()
      if (!settingContactUs) {
        return null
      }
      return settingContactUs[0]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลการติดต่อได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateAboutus(@Arg('data') data: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const settingAboutus = await SettingAboutusModel.find()
      const settingAboutusOldData = settingAboutus[0]

      const _id = settingAboutusOldData ? settingAboutusOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingAboutus',
        who: userId,
        beforeUpdate: settingAboutusOldData ? omit(settingAboutusOldData.toObject(), ['history']) : {},
        afterUpdate: { instructiontext: data },
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: { instructiontext: data },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingAboutusModel.bulkWrite(updateData)
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
      const settingAboutus = await SettingAboutusModel.find()
      if (!settingAboutus) {
        return null
      }
      return settingAboutus[0]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลเกี่ยวกับได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateCustomerPolicies(@Arg('data') data: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const settingCustomerPolicies = await SettingCustomerPoliciesModel.find()
      const settingCustomerPoliciesOldData = settingCustomerPolicies[0]

      const version = get(settingCustomerPoliciesOldData, 'version', 0)
      const newVersion = version + 1
      const _id = settingCustomerPoliciesOldData ? settingCustomerPoliciesOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingCustomerPolicies',
        who: userId,
        beforeUpdate: settingCustomerPoliciesOldData
          ? omit(settingCustomerPoliciesOldData.toObject(), ['history'])
          : {},
        afterUpdate: { customerPolicies: data, version: newVersion },
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: { customerPolicies: data, version: newVersion },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingCustomerPoliciesModel.bulkWrite(updateData)
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

  @Query(() => SettingCustomerPolicies, { nullable: true })
  async getCustomerPoliciesInfo(): Promise<SettingCustomerPolicies> {
    try {
      const settingCustomerPolicies = await SettingCustomerPoliciesModel.find()
      if (!settingCustomerPolicies) {
        const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return settingCustomerPolicies[0]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateCustomerTerms(@Arg('data') data: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const settingCustomerTerms = await SettingCustomerTermsModel.find()
      const settingCustomerTermsOldData = settingCustomerTerms[0]

      const version = get(settingCustomerTermsOldData, 'version', 0)
      const newVersion = version + 1
      const _id = settingCustomerTermsOldData ? settingCustomerTermsOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingCustomerTerms',
        who: userId,
        beforeUpdate: settingCustomerTermsOldData ? omit(settingCustomerTermsOldData.toObject(), ['history']) : {},
        afterUpdate: { customerTerms: data, version: newVersion },
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: { customerTerms: data, version: newVersion },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingCustomerTermsModel.bulkWrite(updateData)
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

  @Query(() => SettingCustomerTerms, { nullable: true })
  async getCustomerTermsInfo(): Promise<SettingCustomerTerms> {
    try {
      const settingCustomerTerms = await SettingCustomerTermsModel.find()
      if (!settingCustomerTerms) {
        const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return settingCustomerTerms[0]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateDriverPolicies(@Arg('data') data: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const settingDriverPolicies = await SettingDriverPoliciesModel.find()
      const settingDriverPoliciesOldData = settingDriverPolicies[0]

      const version = get(settingDriverPoliciesOldData, 'version', 0)
      const newVersion = version + 1
      const _id = settingDriverPoliciesOldData ? settingDriverPoliciesOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingDriverPolicies',
        who: userId,
        beforeUpdate: settingDriverPoliciesOldData ? omit(settingDriverPoliciesOldData.toObject(), ['history']) : {},
        afterUpdate: { driverPolicies: data, version: newVersion },
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: { driverPolicies: data, version: newVersion },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingDriverPoliciesModel.bulkWrite(updateData)
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

  @Query(() => SettingDriverPolicies, { nullable: true })
  async getDriverPoliciesInfo(): Promise<SettingDriverPolicies> {
    try {
      const settingDriverPolicies = await SettingDriverPoliciesModel.find()
      const policy = get(settingDriverPolicies, '0', undefined)
      if (!policy) {
        const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return policy
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateDriverTerms(@Arg('data') data: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const settingDriverTerms = await SettingDriverTermsModel.find()
      const settingDriverTermsOldData = settingDriverTerms[0]

      const version = get(settingDriverTermsOldData, 'version', 0)
      const newVersion = version + 1
      const _id = settingDriverTermsOldData ? settingDriverTermsOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingDriverTerms',
        who: userId,
        beforeUpdate: settingDriverTermsOldData ? omit(settingDriverTermsOldData.toObject(), ['history']) : {},
        afterUpdate: { driverTerms: data, version: newVersion },
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: { driverTerms: data, version: newVersion },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingDriverTermsModel.bulkWrite(updateData)
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

  @Query(() => SettingDriverTerms, { nullable: true })
  async getDriverTermsInfo(): Promise<SettingDriverTerms> {
    try {
      const settingDriverTerms = await SettingDriverTermsModel.find()
      const policy = get(settingDriverTerms, '0', undefined)
      if (!policy) {
        const message = `ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return policy
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateBusinessType(
    @Arg('data', () => [SettingBusinessTypeInput]) data: SettingBusinessTypeInput[],
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    try {
      await BusinessTypesSchema.validate({ businessTypes: data })

      const userId = ctx.req.user_id

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

  @Query(() => [SettingBusinessType], { nullable: true })
  async getBusinessTypeInfo(
    @Arg('includeOther', { nullable: true }) oncludeOther: boolean = false,
  ): Promise<SettingBusinessType[]> {
    try {
      const currentDate = new Date()
      const other: SettingBusinessType = {
        _id: '',
        available: true,
        name: 'อื่นๆ',
        createdAt: currentDate,
        updatedAt: currentDate,
        history: [],
        seq: 999,
      }
      const settingBusinessTypes = await SettingBusinessTypeModel.findAvailable()
      if (!settingBusinessTypes) {
        return [...(oncludeOther ? [other] : [])]
      }
      return [...settingBusinessTypes, ...(oncludeOther ? [other] : [])]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทธุรกิจได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateFAQ(
    @Arg('data', () => [SettingFAQInput]) data: SettingFAQInput[],
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    try {
      await FAQsSchema.validate({ faqs: data })

      const userId = ctx.req.user_id

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

  @Query(() => [SettingFAQ], { nullable: true })
  async getFAQInfo(): Promise<SettingFAQ[]> {
    try {
      const settingFAQs = await SettingFAQModel.find()
      if (!settingFAQs) {
        return []
      }
      return settingFAQs
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลคำถามที่พบบ่อยได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateInstruction(
    @Arg('data', () => [SettingInstructionInput]) data: SettingInstructionInput[],
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    try {
      await InstructionsSchema.validate({ instructions: data })

      const userId = ctx.req.user_id

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

  @Query(() => [SettingInstruction], { nullable: true })
  async getInstructionInfo(): Promise<SettingInstruction[]> {
    try {
      const settingInstruction = await SettingInstructionModel.find()
      if (!settingInstruction) {
        return []
      }
      return settingInstruction
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลคำแนะนำได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateFinancial(@Arg('data') data: SettingFinancialInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const user = await UserModel.findById(userId)
      if (!user || !user.adminDetail) {
        const message = `ไม่สามารถเรียกข้อมูลผู้ใช้ได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const adminDetail = user.adminDetail as Admin
      if (adminDetail.permission !== EAdminPermission.OWNER) {
        const message = `ไม่สามารถอัพเดทข้อมูลได้ เนื่องจากหน้าที่ของท่านไม่สามารถทำได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      
      const settingFinancial = await SettingFinancialModel.find()
      const settingFinancialOldData = settingFinancial[0]

      const _id = settingFinancialOldData ? settingFinancialOldData._id : new Types.ObjectId()

      const updateHistory = new UpdateHistoryModel({
        referenceId: _id.toString(),
        referenceType: 'SettingFinancial',
        who: userId,
        beforeUpdate: settingFinancialOldData ? omit(settingFinancialOldData.toObject(), ['history']) : {},
        afterUpdate: data,
      })

      const updateData = [
        {
          updateOne: {
            filter: { _id },
            update: {
              $set: data,
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        },
      ]

      await SettingFinancialModel.bulkWrite(updateData)
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

  @Query(() => SettingFinancial, { nullable: true })
  async getFinancialInfo(): Promise<SettingFinancial> {
    try {
      const settingFinancial = await SettingFinancialModel.find()
      if (!settingFinancial) {
        return null
      }
      return settingFinancial[0]
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลการเงินได้ โปรดลองอีกครั้ง')
    }
  }
}
