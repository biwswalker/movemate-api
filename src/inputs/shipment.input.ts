import { ArgsType, Field, Float, InputType } from 'type-graphql'
import { FileInput } from './file.input'
import { LocationInput } from './location.input'
import { PODAddressInput } from './booking.input'
import { EPaymentMethod, EPaymentStatus } from '@enums/payments'
import { EShipmentStatusCriteria } from '@enums/shipments'

@InputType()
class DestinationInput {
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
class PaymentDetailInput {
  @Field()
  name: string

  @Field()
  address: string

  @Field()
  province: string

  @Field()
  district: string

  @Field()
  subDistrict: string

  @Field()
  postcode: string

  @Field()
  contactNumber: string
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

  @Field(() => PaymentDetailInput, { nullable: true })
  paymentDetail?: PaymentDetailInput

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

@ArgsType()
export class GetShipmentArgs {
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

  // Recheck
  @Field(() => EPaymentStatus, { nullable: true })
  paymentStatus?: EPaymentStatus

  @Field({ nullable: true })
  paymentNumber?: string

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
}
