import { Field, InputType } from 'type-graphql'
import { FileInput } from './file.input'
import { EPaymentMethod } from '@enums/payments'
import { EBillingCriteriaState, EBillingCriteriaStatus, ECreditDisplayStatus, EDisplayStatus, EGeneralBillingDisplayStatus } from '@enums/billing'
import { EUserCriterialType } from '@enums/users'

@InputType()
export class GetBillingInput {
  @Field(() => EBillingCriteriaStatus, { nullable: true })
  status?: EBillingCriteriaStatus

  @Field(() => EBillingCriteriaState, { nullable: true })
  state?: EBillingCriteriaState

  @Field({ nullable: true })
  billingNumber?: string

  @Field({ nullable: true })
  receiptNumber?: string

  @Field({ nullable: true })
  customerName?: string

  @Field(() => EUserCriterialType, { nullable: true })
  userType?: EUserCriterialType

  @Field(() => EPaymentMethod, { nullable: true })
  paymentMethod?: EPaymentMethod

  @Field(() => [Date], { nullable: true })
  billedDate?: Date[]

  @Field(() => [Date], { nullable: true })
  issueDate?: Date[]

  @Field(() => [Date], { nullable: true })
  receiptDate?: Date[]

  @Field({ nullable: true })
  shipmentNumber?: string

  @Field({ nullable: true })
  customerId?: string

  @Field(() => [EDisplayStatus], {
    nullable: true,
    description: 'กรองตามสถานะ (หากไม่ระบุ จะแสดงทั้งหมด)',
  })
  cashStatuses?: EDisplayStatus[]

  @Field(() => [ECreditDisplayStatus], {
    nullable: true,
    description: 'กรองตามสถานะ (หากไม่ระบุ จะแสดงทั้งหมด)',
  })
  creditStatuses?: ECreditDisplayStatus[]
  
  @Field(() => [EGeneralBillingDisplayStatus], {
    nullable: true,
    description: 'กรองตามสถานะ (หากไม่ระบุ จะแสดงทั้งหมด)',
  })
  displayStatus?: EGeneralBillingDisplayStatus[]
}

@InputType()
export class ProcessBillingRefundInput {
  @Field()
  billingId: string

  @Field()
  paymentId: string

  @Field(() => Boolean)
  isRefunded: boolean

  @Field({ nullable: true })
  reason: string

  @Field(() => FileInput, { nullable: true })
  imageEvidence: FileInput

  @Field({ nullable: true })
  paymentDate: Date

  @Field({ nullable: true })
  paymentTime: Date

  @Field({ nullable: true })
  amount: number
}
