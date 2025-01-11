import { Field, InputType } from 'type-graphql'
import { FileInput } from './file.input'

@InputType()
export class MakePayBillingInput {
  @Field(() => FileInput)
  image: FileInput

  @Field()
  bank: string

  @Field()
  bankName: string

  @Field()
  bankNumber: string

  @Field()
  paymentDate: Date

  @Field()
  paymentTime: Date
}
