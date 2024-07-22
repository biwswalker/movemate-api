import { VehicleCost } from '@models/vehicleCost.model'
import { ObjectType, Field, Float } from 'type-graphql'
import { prop as Property, Severity } from '@typegoose/typegoose'

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

    // @Field()
    // faveriteDrivers: string[]

    @Field(() => [paymentMethodPayload])
    paymentMethods: paymentMethodPayload[]
}

@ObjectType()
export class PriceItem {
    @Field()
    label: string

    @Field(() => Float)
    price: number
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

    @Field(() => Float)
    @Property()
    total: number
}