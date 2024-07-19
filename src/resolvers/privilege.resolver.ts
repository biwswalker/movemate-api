import { AuthGuard } from '@guards/auth.guards'
import { GetPrivilegesArgs, PrivilegeInput } from '@inputs/privilege.input'
import { PaginationArgs } from '@inputs/query.input'
import PrivilegeModel, { Privilege } from '@models/privilege.model'
import { PrivilegePaginationPayload } from '@payloads/privilege.payloads'
import { yupValidationThrow } from '@utils/error.utils'
import { PrivilegeSchema } from '@validations/privilege.validations'
import { GraphQLError } from 'graphql'
import { isArray, isEmpty, omitBy, reduce } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { Arg, Args, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver()
export default class PrivilegeResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
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
  @UseMiddleware(AuthGuard(['admin']))
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
  @Query(() => PrivilegePaginationPayload)
  @UseMiddleware(AuthGuard(['admin']))
  async getPrivileges(
    @Args() query: GetPrivilegesArgs,
    @Args() { sortField, sortAscending, ...paginationArgs }: PaginationArgs
  ): Promise<PrivilegePaginationPayload> {
    try {
      // Pagination
      const pagination: PaginateOptions = {
        ...paginationArgs,
        ...(isArray(sortField)
          ? {
            sort: reduce(
              sortField,
              function (result, value) {
                return { ...result, [value]: sortAscending ? 1 : -1 };
              },
              {}
            ),
          }
          : {}),
      };
      // Filter
      const filterEmptyQuery = omitBy(query, isEmpty)
      const filterQuery: FilterQuery<typeof Privilege> = {
        ...filterEmptyQuery,
        ...(query.name ? { name: { $regex: query.name, $options: "i" }} : {}),
        ...(query.code ? { code: { $regex: query.code, $options: "i" }} : {}),
      }

      const privilege = await PrivilegeModel.paginate(filterQuery, pagination) as PrivilegePaginationPayload
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
  @UseMiddleware(AuthGuard(['admin']))
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
  @UseMiddleware(AuthGuard(['admin', 'customer']))
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
  @UseMiddleware(AuthGuard(['admin']))
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
  @Query(() => [Privilege])
  @UseMiddleware(AuthGuard(['admin', 'customer']))
  async searchPrivilegeByCode(@Arg('code') code: string): Promise<Privilege[]> {
    try {
      const privileges = await PrivilegeModel.find({ code: (code || '').toUpperCase(), status: 'active' })
      if (!privileges) {
        const message = `ไม่สามารถเรียกข้อมูลส่วนลดได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return privileges
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }
}
