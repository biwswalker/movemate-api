import { Field, InputType } from 'type-graphql'
import { FileInput } from './file.input'

@InputType()
export class ConfirmShipmentDateInput {
  @Field()
  shipmentId: string

  @Field()
  datetime: Date
}

@InputType()
export class NextShipmentStepInput {
  @Field()
  shipmentId: string

  @Field(() => [FileInput], { nullable: true })
  images?: FileInput[]
}

@InputType()
export class SentPODDocumentShipmentStepInput {
  @Field()
  shipmentId: string

  @Field(() => [FileInput])
  images: FileInput[]

  @Field()
  provider: string

  @Field()
  trackingNumber: string
}