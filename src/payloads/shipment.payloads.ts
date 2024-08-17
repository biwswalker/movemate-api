import { Field, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult, PaginateResult } from 'mongoose'
import { Shipment } from '@models/shipment.model'

@ObjectType()
export class ShipmentPaginationPayload extends PaginationPayload implements PaginateResult<Shipment> {
  @Field(() => [Shipment])
  docs: Shipment[]
}

@ObjectType()
export class ShipmentPaginationAggregatePayload extends PaginationPayload implements AggregatePaginateResult<Shipment> {
  @Field(() => [Shipment])
  docs: Shipment[]
}

@ObjectType()
export class TotalRecordPayload {
  @Field()
  label: string

  @Field()
  key: TCriteriaStatus

  @Field(() => Int)
  count: number
}
