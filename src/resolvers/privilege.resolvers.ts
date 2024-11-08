import { GraphQLContext } from '@configs/graphQL.config'
import { EPrivilegeStatus } from '@enums/privilege'
import { EUserRole } from '@enums/users'
import { AllowGuard, AuthGuard } from '@guards/auth.guards'
import { GetPrivilegesArgs, PrivilegeInput } from '@inputs/privilege.input'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import PrivilegeModel, { Privilege } from '@models/privilege.model'
import { PrivilegePaginationPayload, PrivilegeUsedPayload } from '@payloads/privilege.payloads'
import { yupValidationThrow } from '@utils/error.utils'
import { reformPaginate } from '@utils/pagination.utils'
import { PrivilegeSchema } from '@validations/privilege.validations'
import { GraphQLError } from 'graphql'
import { filter, includes, isEmpty, isEqual, map, omitBy } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver()
export default class PrivilegeResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async addPrivilege(@Arg('data') data: PrivilegeInput): Promise<boolean> {
    try {
      await PrivilegeSchema().validate(data, { abortEarly: false })
      const privilege = new PrivilegeModel(data)
      await privilege.save()
      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updatePrivilege(@Arg('id') id: string, @Arg('data') data: PrivilegeInput): Promise<boolean> {
    try {
      await PrivilegeSchema(id).validate(data, { abortEarly: false })
      await PrivilegeModel.findByIdAndUpdate(id, data)
      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
  @Query(() => [Privilege])
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async privileges(
    @Args() query: GetPrivilegesArgs,
    @Args() { skip, limit, ...paginate }: LoadmoreArgs,
  ): Promise<Privilege[]> {
    try {
      // Pagination
      const pagination: PaginateOptions = reformPaginate(paginate)
      // Filter
      const filterEmptyQuery = omitBy(query, isEmpty)
      const filterQuery: FilterQuery<typeof Privilege> = {
        ...filterEmptyQuery,
        ...(query.name ? { name: { $regex: query.name, $options: 'i' } } : {}),
        ...(query.code ? { code: query.code } : { defaultShow: true }),
      }

      const privileges = await PrivilegeModel.find(filterQuery).skip(skip).limit(limit)
      return privileges
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => PrivilegePaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPrivileges(
    @Args() query: GetPrivilegesArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<PrivilegePaginationPayload> {
    try {
      // Pagination
      const pagination: PaginateOptions = reformPaginate(paginate)
      // Filter
      const filterEmptyQuery = omitBy(query, isEmpty)
      const filterQuery: FilterQuery<typeof Privilege> = {
        ...filterEmptyQuery,
        ...(query.name ? { name: { $regex: query.name, $options: 'i' } } : {}),
        ...(query.code ? { code: { $regex: query.code, $options: 'i' } } : {}),
      }

      const privilege = (await PrivilegeModel.paginate(filterQuery, pagination)) as PrivilegePaginationPayload
      if (!privilege) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return privilege
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => Privilege)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPrivilege(@Arg('name') name: string): Promise<Privilege> {
    try {
      const privilege = await PrivilegeModel.findOne({ name })
      if (!privilege) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้ได้ เนื่องจากไม่พบส่วนลดดังกล่าว`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return privilege
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => Privilege)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN, EUserRole.CUSTOMER]))
  async getPrivilegeById(@Arg('id') id: string): Promise<Privilege> {
    try {
      const privilege = await PrivilegeModel.findById(id)
      if (!privilege) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้ได้ เนื่องจากไม่พบส่วนลดดังกล่าว`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return privilege
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => Privilege)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPrivilegeByCode(@Arg('code') code: string): Promise<Privilege> {
    try {
      const privilege = await PrivilegeModel.findOne({ code: code })
      if (!privilege) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return privilege
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => [PrivilegeUsedPayload])
  @UseMiddleware(AllowGuard)
  async searchPrivilegeByCode(@Arg('code') code: string, @Ctx() ctx: GraphQLContext): Promise<PrivilegeUsedPayload[]> {
    const user_id = ctx.req.user_id
    try {
      const searchedCode = (code || '').toUpperCase()
      const privileges = await PrivilegeModel.find({
        ...(searchedCode ? { code: searchedCode } : { defaultShow: true }),
        status: EPrivilegeStatus.ACTIVE,
      }).lean()
      if (!privileges) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      const privilegePayload = map<Privilege, PrivilegeUsedPayload>(privileges, (privilege) => {
        const usedUser = map(privilege.usedUser, user => user.toString())
        const isUsed = includes(usedUser, user_id)
        return { ...privilege, used: isUsed }
      })
      return privilegePayload
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
}
