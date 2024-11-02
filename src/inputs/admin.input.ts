import { Field, InputType } from 'type-graphql'
import { IsEmail } from 'class-validator'
import { EUserStatus } from '@enums/users'

@InputType()
export class AddAdminInput {
  @Field()
  permission: TAdminPermission

  @Field()
  status: EUserStatus

  @Field()
  @IsEmail()
  email: string

  @Field()
  firstname: string

  @Field()
  lastname: string

  @Field()
  phoneNumber: string

  @Field({ nullable: true })
  taxId: string

  @Field({ nullable: true })
  address: string
}
