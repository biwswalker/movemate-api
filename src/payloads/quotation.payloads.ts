import { Price, QuotationDetail } from '@models/finance/objects'
import { Field, Float, ObjectType } from 'type-graphql'

@ObjectType()
export class CalculateQuotationResultPayload {
  @Field(() => QuotationDetail)
  detail: QuotationDetail

  @Field(() => Price)
  price: Price

  @Field(() => Price)
  cost: Price

  @Field(() => Float)
  displayDistance: number

  @Field(() => Float)
  displayTime: number

  @Field(() => Float)
  returnDistance: number

  @Field(() => Float)
  distance: number

  routes: google.maps.DirectionsResult
}
