import { ArgsType, Field, Float, InputType, Int } from 'type-graphql'
import { DestinationInput } from './shipment.input'
import { EPriceItemType } from '@enums/billing'

@InputType()
export class PODAddressInput {
  @Field({ nullable: true })
  _id?: string

  @Field()
  fullname: string

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
  phoneNumber: string

  @Field({ nullable: true })
  remark?: string
}

@ArgsType()
export class SubtotalCalculationArgs {
  @Field(() => Int)
  dropPoint: number

  @Field(() => Float)
  distanceMeter: number

  @Field(() => Float)
  distanceReturnMeter: number

  @Field(() => Boolean)
  isRounded: boolean

  @Field()
  vehicleTypeId: string

  @Field(() => [String], { nullable: true })
  serviceIds?: string[]

  @Field({ nullable: true })
  discountId?: string

  @Field()
  isBusinessCashPayment: boolean
}

@InputType()
export class CalculationInput {
  @Field({ nullable: true })
  shipmentId?: string

  @Field(() => [DestinationInput])
  locations: DestinationInput[]

  @Field(() => Boolean)
  isRounded: boolean

  @Field()
  vehicleTypeId: string

  @Field(() => [String], { nullable: true })
  serviceIds?: string[]

  @Field({ nullable: true })
  discountId?: string
}

@InputType()
export class PriceItemInput {
  @Field()
  label: string

  @Field(() => Float)
  price: number

  @Field(() => Float)
  cost: number
}

@InputType()
export class PriceEditorItemInput {
  @Field()
  label: string

  @Field(() => Float)
  price: number

  @Field(() => Float)
  cost: number

  @Field(() => EPriceItemType)
  type: EPriceItemType

  @Field({ nullable: true })
  refId?: string
}

@InputType()
export class QuotationEditorDetailInput {
  @Field(() => PriceEditorItemInput)
  shipping: PriceEditorItemInput

  @Field(() => PriceEditorItemInput, { nullable: true })
  rounded?: PriceEditorItemInput

  @Field(() => [PriceEditorItemInput], { nullable: true, defaultValue: [] })
  services?: PriceEditorItemInput[]

  @Field(() => PriceEditorItemInput, { nullable: true })
  discounts?: PriceEditorItemInput

  @Field(() => PriceEditorItemInput, { nullable: true })
  taxs?: PriceEditorItemInput

  @Field(() => Float)
  total: number

  @Field(() => Float)
  subTotal: number

  @Field(() => Float)
  tax: number
  
  @Field(() => Float)
  subTotalCost: number

  @Field(() => Float)
  taxCost: number

  @Field(() => Float)
  totalCost: number
}

@InputType()
export class UpdateShipmentInput {
  @Field({ nullable: true })
  shipmentId?: string

  @Field(() => [DestinationInput])
  locations: DestinationInput[]

  @Field(() => Boolean)
  isRounded: boolean

  @Field()
  vehicleTypeId: string

  @Field(() => [String], { nullable: true })
  serviceIds?: string[]

  @Field({ nullable: true })
  discountId?: string

  @Field(() => PODAddressInput, { nullable: true })
  podDetail?: PODAddressInput

  @Field(() => QuotationEditorDetailInput, { nullable: true })
  quotation?: QuotationEditorDetailInput

  @Field(() => String, { nullable: true })
  remark?: string
}
