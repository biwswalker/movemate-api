import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { ContactInput } from '@inputs/contact.input'
import { LoadmoreArgs } from '@inputs/query.input'
import ContactModel, { Contact } from '@models/contact.model'
import { yupValidationThrow } from '@utils/error.utils'
import { ContactSchema } from '@validations/contact.validations'
import { Arg, Args, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver(Contact)
export default class ContactResolver {
  @Query(() => [Contact])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getContacts(@Args() { skip, limit, ...paginate }: LoadmoreArgs): Promise<Contact[]> {
    const contacts = await ContactModel.find().sort({ createdAt: 1 }).exec()
    return contacts
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
