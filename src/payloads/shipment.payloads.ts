import { Field, Float, ID, Int, ObjectType } from 'type-graphql'
import {
  EAdminAcceptanceStatus,
  EDriverAcceptanceStatus,
  EShipmentStatus,
  EShipmentStatusCriteria,
} from '@enums/shipments'
import { EPaymentMethod } from '@enums/payments'
import { EBillingState, EBillingStatus } from '@enums/billing'
import { Destination } from '@models/shipment/objects'
import { StepDefinition } from '@models/shipmentStepDefinition.model'

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
  vehicleImage: string

  @Field()
  customerTitle: string

  @Field()
  customerName: string

  @Field({ nullable: true })
  driverTitle: string

  @Field({ nullable: true })
  driverName: string

  @Field({ nullable: true })
  driverProfileImage?: string

  @Field({ nullable: true })
  driverNumber?: string

  @Field({ nullable: true })
  agentDriverTitle: string

  @Field({ nullable: true })
  agentDriverName: string

  @Field(() => [Destination])
  destinations: Destination[]

  @Field()
  createdAt: Date

  @Field({ nullable: true })
  refId: string

  @Field(() => StepDefinition, { nullable: true })
  step: StepDefinition

  @Field(() => Float, { nullable: true, defaultValue: 0 })
  cancellationFee: number
}

@ObjectType()
export class ShipmentTimeCheckPayload {
  @Field(() => Boolean)
  isCriticalTime: boolean // น้อยกว่า 120 นาที

  @Field(() => Boolean)
  isWarningTime: boolean // น้อยกว่า 180 นาที แต่ไม่ถึงขั้น Critical

  @Field(() => Int)
  timeDifferenceInMinutes: number
}

@ObjectType({ description: 'ข้อมูลการติดตามสถานะการจัดส่งสำหรับบุคคลภายนอก' })
export class PublicTrackingPayload {
  @Field(() => EShipmentStatus)
  status: EShipmentStatus
  
  @Field(() => Boolean, { nullable: true })
  isRoundedReturn?: boolean

  @Field(() => [Destination], { description: 'ข้อมูลจุดรับและจุดส่งทั้งหมด' })
  destinations: Destination[]

  @Field(() => [StepDefinition], { description: 'ขั้นตอนการทำงานทั้งหมด' })
  steps: StepDefinition[]

  @Field(() => StepDefinition, { nullable: true, description: 'ขั้นตอนปัจจุบันที่กำลังดำเนินการ' })
  currentStep?: StepDefinition
}
