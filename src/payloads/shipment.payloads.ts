import { Field, ID, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult, PaginateResult } from 'mongoose'
import { Shipment } from '@models/shipment.model'
import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { EPaymentMethod } from '@enums/payments'
import { EBillingState, EBillingStatus } from '@enums/billing'
import { Destination } from '@models/shipment/objects'

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
  key: EShipmentStatusCriteria

  @Field(() => Int)
  count: number
}

@ObjectType()
export class ShipmentListPayload {
  @Field(() => ID)
  _id: string

  @Field()
  bookingDateTime: Date

  @Field()
  trackingNumber: string

  @Field(() => EShipmentStatus)
  status: EShipmentStatus

  @Field(() => EAdminAcceptanceStatus, { nullable: true })
  adminAcceptanceStatus: EAdminAcceptanceStatus

  @Field(() => EDriverAcceptanceStatus, { nullable: true })
  driverAcceptanceStatus: EDriverAcceptanceStatus

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field(() => EBillingStatus, { nullable: true })
  billingStatus: EBillingStatus

  @Field(() => EBillingState, { nullable: true })
  billingState: EBillingState

  @Field()
  vehicleName: string

  @Field()
  customerTitle: string

  @Field()
  customerName: string

  @Field({ nullable: true })
  driverTitle: string

  @Field({ nullable: true })
  driverName: string

  @Field({ nullable: true })
  agentDriverTitle: string

  @Field({ nullable: true })
  agentDriverName: string

  @Field(() => [Destination])
  destinations: Destination[]

  @Field()
  createdAt: Date
}
