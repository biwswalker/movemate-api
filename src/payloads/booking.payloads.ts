import { VehicleCost } from '@models/vehicleCost.model'
import { ObjectType, Field, Float } from 'type-graphql'
import { prop as Property, Severity } from '@typegoose/typegoose'
import { User } from '@models/user.model'

@ObjectType()
export class paymentMethodPayload {
  @Field()
  available: boolean

  @Field()
  method: string

  @Field()
  name: string

  @Field()
  subTitle: string

  @Field()
  detail: string
}

@ObjectType()
export class BookingConfigPayload {
  @Field(() => [VehicleCost])
  vehicleCosts: VehicleCost[]

  @Field(() => [User])
  faveriteDrivers: User[]

  @Field(() => [paymentMethodPayload])
  paymentMethods: paymentMethodPayload[]
}

@ObjectType()
export class PriceItem {
  @Field()
  label: string

  @Field(() => Float)
  price: number

  @Field(() => Float, { defaultValue: 0, nullable: true })
  cost: number
}

@ObjectType()
export class SubtotalCalculatedPayload {
  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  shippingPrices: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  discounts: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  additionalServices: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  taxs: PriceItem[]

  @Field(() => Float, { defaultValue: 0 })
  @Property()
  subTotalCost: number

  @Field(() => Float, { defaultValue: 0 })
  @Property()
  subTotalPrice: number

  @Field(() => Float, { defaultValue: 0 })
  @Property()
  totalCost: number

  @Field(() => Float, { defaultValue: 0 })
  @Property()
  totalPrice: number
}
