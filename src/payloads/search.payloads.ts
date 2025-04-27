import { PaginateResult } from 'mongoose'
import { PaginationPayload } from './pagination.payloads'
import { SearchHistory } from '@models/searchHistory.model'
import { Field, Float, ObjectType } from 'type-graphql'
import { CalculateQuotationResultPayload } from './quotation.payloads'
import { CalculationInput } from '@inputs/booking.input'

@ObjectType()
export class SearchHistoryPaginationPayload
  extends PaginationPayload
  implements PaginateResult<SearchHistoryWithDataPayload>
{
  @Field(() => [SearchHistoryWithDataPayload])
  docs: SearchHistoryWithDataPayload[]
}

@ObjectType()
class LocationPayload {
  @Field(() => Float)
  latitude: number

  @Field(() => Float)
  longitude: number
}

@ObjectType()
export class DestinationPayload {
  @Field({ nullable: true })
  placeId: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  detail: string

  @Field(() => LocationPayload, { nullable: true })
  location: LocationPayload

  @Field({ nullable: true })
  contactName: string

  @Field({ nullable: true })
  contactNumber: string

  @Field({ nullable: true })
  customerRemark: string
}

@ObjectType()
class CalculationInputWithLabelPayload extends CalculationInput {
  @Field({ nullable: true })
  shipmentId?: string

  @Field(() => [DestinationPayload], { nullable: true })
  locations: DestinationPayload[]

  @Field(() => Boolean, { nullable: true })
  isRounded: boolean

  @Field({ nullable: true })
  vehicleTypeId: string

  @Field(() => [String], { nullable: true })
  serviceIds?: string[]

  @Field({ nullable: true })
  discountId?: string

  @Field({ nullable: true })
  vehicleName: string

  @Field(() => String, { nullable: true })
  services: string

  @Field({ nullable: true })
  discount: string
}

@ObjectType()
export class SearchHistoryWithDataPayload extends SearchHistory {
  @Field(() => CalculationInputWithLabelPayload, { nullable: true })
  input: CalculationInputWithLabelPayload

  @Field(() => CalculateQuotationResultPayload, { nullable: true })
  result: CalculateQuotationResultPayload
}
