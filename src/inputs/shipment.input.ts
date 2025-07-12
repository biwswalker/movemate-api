import { Field, Float, InputType, Int } from 'type-graphql'
import { FileInput } from './file.input'
import { LocationInput } from './location.input'
import { PODAddressInput } from './booking.input'
import { EPaymentMethod } from '@enums/payments'
import { EShipmentStatus, EShipmentStatusCriteria } from '@enums/shipments'
import { EBillingStatus } from '@enums/billing'

@InputType()
export class DestinationInput {
  @Field()
  placeId: string

  @Field()
  name: string

  @Field()
  detail: string

  @Field(() => LocationInput)
  location: LocationInput

  @Field()
  contactName: string

  @Field()
  contactNumber: string

  @Field({ nullable: true })
  customerRemark: string
}

@InputType()
class TransferPaymentDetailInput {
  @Field(() => FileInput)
  imageEvidence: FileInput

  @Field()
  bank: string

  @Field()
  bankName: string

  @Field()
  bankNumber: string

  @Field()
  paymentDate: Date

  @Field()
  paymentTime: Date
}

@InputType()
export class ShipmentInput {
  @Field(() => [DestinationInput])
  locations: DestinationInput[]

  @Field(() => Float)
  displayDistance: number

  @Field()
  displayTime: number

  @Field(() => Float)
  distance: number

  @Field(() => Float)
  returnDistance: number

  @Field()
  isRoundedReturn: boolean

  @Field()
  vehicleId: string

  @Field({ nullable: true })
  favoriteDriverId?: string

  @Field(() => [String], { nullable: true })
  additionalServices?: string[]

  @Field(() => PODAddressInput, { nullable: true })
  podDetail?: PODAddressInput

  @Field(() => EPaymentMethod)
  paymentMethod: EPaymentMethod

  @Field(() => TransferPaymentDetailInput, { nullable: true })
  cashPaymentDetail?: TransferPaymentDetailInput

  @Field({ nullable: true })
  discountId?: string

  @Field()
  isBookingWithDate: boolean

  @Field({ nullable: true })
  bookingDateTime?: Date

  @Field(() => [FileInput], { nullable: true })
  additionalImage?: FileInput[]

  @Field({ nullable: true })
  refId?: string

  @Field({ nullable: true })
  remark?: string

  // @Field(() => GraphQLJSONObject)
  // directionRoutes: google.maps.DirectionsResult
  @Field()
  directionRoutes: string
}

@InputType()
export class GetShipmentInput {
  @Field({ nullable: true })
  _id?: string

  // Included RefId
  @Field({ nullable: true })
  trackingNumber?: string

  @Field(() => EShipmentStatusCriteria, { nullable: true })
  status?: EShipmentStatusCriteria

  @Field({ nullable: true })
  vehicleTypeId?: string

  @Field(() => EPaymentMethod, { nullable: true })
  paymentMethod?: EPaymentMethod

  @Field(() => Date, { nullable: true })
  dateRangeStart?: Date

  @Field(() => Date, { nullable: true })
  dateRangeEnd?: Date

  // News
  @Field(() => Date, { nullable: true })
  startWorkingDate?: Date

  @Field(() => Date, { nullable: true })
  endWorkingDate?: Date

  @Field(() => EBillingStatus, { nullable: true })
  billingStatus?: EBillingStatus

  @Field({ nullable: true })
  customerName?: string

  @Field({ nullable: true })
  driverName?: string

  @Field({ nullable: true })
  driverAgentName?: string

  // By ID
  @Field({ nullable: true })
  customerId?: string

  @Field({ nullable: true })
  driverId?: string

  @Field(() => [EShipmentStatus], { nullable: true })
  sortOrder?: EShipmentStatus[]
}

@InputType({ description: 'ข้อมูลรายรับและรายจ่ายสำหรับแต่ละรายการที่แก้ไข' })
export class ModifiedShipmentItemInput {
  @Field({ description: 'ชื่อรายการ' })
  name: string

  @Field(() => Int, { description: 'จำนวน' })
  quantity: number

  @Field(() => Float, { description: 'ราคาขายต่อหน่วย (สำหรับลูกค้า)' })
  price: number

  @Field(() => Float, { description: 'ต้นทุนต่อหน่วย (สำหรับภายใน)' })
  cost: number
}

@InputType({ description: 'ข้อมูลทั้งหมดสำหรับการแก้ไขงานขนส่ง' })
export class ModificationShipmentInput {
  @Field(() => [ModifiedShipmentItemInput], { description: 'รายการทั้งหมดที่อัปเดตใหม่' })
  items: ModifiedShipmentItemInput[]

  @Field({ nullable: true, description: 'หมายเหตุเพิ่มเติมสำหรับการแก้ไข' })
  modificationReason?: string
}
