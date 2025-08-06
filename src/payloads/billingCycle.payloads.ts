import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { AggregatePaginateResult } from 'mongoose'
import { EBillingCriteriaStatus, EBillingInfoStatus, EBillingState, EBillingStatus } from '@enums/billing'
import { Billing } from '@models/finance/billing.model'
import { EPaymentMethod, EPaymentStatus, EPaymentType } from '@enums/payments'
import { EUserType } from '@enums/users'

@ObjectType()
export class BillingListPayload {
  @Field(() => ID)
  _id: string

  @Field(() => String)
  billingNumber: string

  @Field(() => EBillingStatus)
  status: EBillingStatus

  @Field(() => String)
  displayStatus: string

  @Field(() => String)
  displayStatusName: string

  @Field(() => EBillingState)
  state: EBillingState

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field(() => String)
  userId: string

  @Field(() => EUserType)
  userType: EUserType

  @Field(() => String)
  userTitle: string

  @Field(() => String)
  userFullname: string

  @Field(() => Date)
  createdAt: Date

  @Field(() => Float, { nullable: true })
  latestQuotationTax: number

  @Field(() => Float, { nullable: true })
  latestQuotationPrice: number

  @Field(() => Float, { nullable: true })
  latestAmount: number

  @Field(() => EPaymentStatus, { nullable: true })
  latestPaymentStatus: EPaymentStatus

  @Field(() => EPaymentType, { nullable: true })
  latestPaymentType: EPaymentType

  @Field(() => String, { nullable: true })
  receiptNumbers: string

  @Field(() => Date, { nullable: true })
  latestReceiptDate: Date

  @Field(() => Date, { nullable: true })
  latestPaymentDate: Date

  @Field(() => String, { nullable: true })
  adjustmentIncreaseNumbers: string

  @Field(() => String, { nullable: true })
  adjustmentDecreaseNumbers: string

  @Field(() => Date, { nullable: true })
  billingStartDate: Date

  @Field(() => Date, { nullable: true })
  billingEndDate: Date

  @Field(() => Date, { nullable: true })
  invoiceDate: Date

  @Field(() => Date, { nullable: true })
  paymentDueDate: Date

  @Field(() => String, { nullable: true })
  invoicePostalStatus: string

  @Field(() => String, { nullable: true })
  invoiceFilename: string

  @Field(() => [String], { nullable: true })
  receiptFilenames: string[]

  @Field(() => String, { nullable: true })
  invoiceTrackingNumber: string

  @Field(() => String, { nullable: true })
  receiptTrackingNumbers: string
}

@ObjectType()
export class BillingListPaginationPayload
  extends PaginationPayload
  implements AggregatePaginateResult<BillingListPayload>
{
  @Field(() => [BillingListPayload])
  docs: BillingListPayload[]
}

@ObjectType()
export class TotalBillingRecordPayload {
  @Field()
  label: string

  @Field()
  key: string

  @Field(() => Int)
  count: number
}

@ObjectType()
export class BillingInfoPayload {
  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field({ nullable: true })
  billingNumber?: string

  @Field(() => EBillingStatus, { nullable: true })
  billingStatus?: EBillingStatus

  @Field(() => EBillingState, { nullable: true })
  billingState?: EBillingState

  @Field(() => EBillingInfoStatus)
  status: EBillingInfoStatus

  @Field({ nullable: true })
  message?: string
}

@ObjectType({ description: 'ผลลัพธ์สถานะของ Billing หนึ่งรายการ' })
export class BillingStatusPayload {
  @Field(() => ID)
  billingId: string

  @Field()
  status: string

  @Field()
  statusName: string

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod
}
