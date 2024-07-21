import { Field, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { PaginateResult } from 'mongoose'
import { Shipment } from '@models/shipment.model'

@ObjectType()
export class ShipmentPaginationPayload extends PaginationPayload implements PaginateResult<Shipment> {
  @Field(() => [Shipment])
  docs: Shipment[]
}
