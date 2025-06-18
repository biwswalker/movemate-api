import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { ContactInput } from '@inputs/contact.input'
import { LoadmoreArgs } from '@inputs/query.input'
import ContactModel, { Contact } from '@models/contact.model'
import { yupValidationThrow } from '@utils/error.utils'
import { ContactSchema } from '@validations/contact.validations'
import { GraphQLError } from 'graphql'
import { FilterQuery } from 'mongoose'
import { Arg, Args, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver(Contact)
export default class ContactResolver {
  @Query(() => [Contact])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getContacts(@Args() { skip, limit, ...paginate }: LoadmoreArgs): Promise<Contact[]> {
    try {
      // Pagination
      // const pagination: PaginateOptions = reformPaginate(paginate)
      // Filter

      const filterQuery: FilterQuery<typeof Contact> = {
        // ...filterEmptyQuery,
        // ...(status ? (status === EPrivilegeStatusCriteria.ALL ? {} : { status: status }) : {}),
        // ...(query.name ? { name: { $regex: query.name, $options: 'i' } } : {}),
        // ...(query.code ? { code: query.code } : { defaultShow: true }),
      }

      const privileges = await ContactModel.find(filterQuery).sort({ createdAt: -1 }).skip(skip).limit(limit)
      return privileges
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลส่วนลดได้ โปรดลองอีกครั้ง')
    }
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER, EUserRole.ADMIN, EUserRole.DRIVER]))
  async totalContact(): Promise<number> {
    const contact = await ContactModel.countDocuments()
    return contact
  }

  @Query(() => Contact)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getContactById(@Arg('id') id: string): Promise<Contact> {
    try {
      const contact = await ContactModel.findById(id)
      if (!contact) {
        throw new GraphQLError('ไม่พบข้อมูลการติดต่อ', {
          extensions: { code: 'NOT_FOUND' },
        })
      }
      if (!contact.read) {
        contact.read = true
        await contact.save()
      }
      return contact
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลการติดต่อได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  async createContact(@Arg('data') data: ContactInput): Promise<boolean> {
    try {
      await ContactSchema.validate(data, { abortEarly: false })
      const _contact = new ContactModel(data)
      _contact.save()
      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
}
