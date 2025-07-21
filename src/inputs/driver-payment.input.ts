import { ArgsType, Field, Float, InputType } from 'type-graphql'
import { FileInput } from './file.input'

@InputType()
export class CreateDriverPaymentInput {
  @Field(() => [String])
  transactionIds: string[]

  @Field(() => FileInput)
  imageEvidence: FileInput

  @Field()
  paymentDate: Date

  @Field()
  paymentTime: Date

  @Field(() => Float)
  subtotal: number

  @Field(() => Float)
  tax: number

  @Field(() => Float)
  total: number
}

@ArgsType()
@InputType()
export class GetDriverPaymentArgs {
  @Field({ nullable: true })
  shipmentTracking?: string

  @Field({ nullable: true })
  driverNumber?: string

  @Field({ nullable: true })
  driverName?: string

  @Field({ nullable: true })
  driverId?: string

  @Field(() => Date, { nullable: true })
  startDate?: Date

  @Field(() => Date, { nullable: true })
  endDate?: Date
}
