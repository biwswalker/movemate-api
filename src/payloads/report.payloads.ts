import { ObjectType, Field, Float, Int } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'

@ObjectType()
class ShipmentCreditorReport {
  @Field({ nullable: true })
  shipmentNo?: string

  @Field({ nullable: true })
  finishedDate?: string

  @Field(() => Float, { nullable: true })
  value?: number
}

@ObjectType()
export class CreditorReportPayload {
  @Field({ nullable: true })
  userId?: string

  @Field({ nullable: true })
  userType?: string

  @Field({ nullable: true })
  fullname?: string

  @Field({ nullable: true })
  taxId?: string

  @Field({ nullable: true })
  contactNumber?: string

  @Field({ nullable: true })
  workingPeriod?: string

  @Field({ nullable: true })
  duedate?: string

  @Field(() => Int, { nullable: true })
  overdueCount?: number

  @Field(() => [ShipmentCreditorReport], { nullable: true })
  shipments?: ShipmentCreditorReport[]

  @Field(() => Float, { nullable: true })
  subtotal?: number

  @Field(() => Float, { nullable: true })
  whtValue?: number

  @Field(() => Float, { nullable: true })
  total?: number

  @Field({ nullable: true })
  paymentDate?: string

  @Field({ nullable: true })
  receiptNo?: string

  @Field({ nullable: true })
  whtNo?: string
}

@ObjectType()
export class CreditorReportResponse
  extends PaginationPayload
  implements AggregatePaginateResult<CreditorReportPayload>
{
  @Field(() => [CreditorReportPayload])
  docs: CreditorReportPayload[]
}
