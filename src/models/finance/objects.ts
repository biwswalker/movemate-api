import { Field, Float, ObjectType } from 'type-graphql'
import { prop as Property, Severity } from '@typegoose/typegoose'
import { EBillingReason } from '@enums/billing'

@ObjectType()
export class PaymentAmounts {
  @Field(() => Float)
  @Property({ default: 0 })
  total: number

  @Field(() => Float)
  @Property({ default: 0 })
  subTotal: number

  @Field(() => Float)
  @Property({ default: 0 })
  tax: number
}

@ObjectType()
export class BillingReason {
  @Field(() => EBillingReason)
  @Property({ enum: EBillingReason })
  type: EBillingReason

  @Field()
  @Property()
  detail: string
}

@ObjectType()
export class Price extends PaymentAmounts {
  @Field(() => Float)
  @Property({ default: 0 })
  acturePrice: number

  @Field(() => Float)
  @Property({ default: 0 })
  droppoint: number

  @Field(() => Float)
  @Property({ default: 0 })
  rounded: number

  @Field(() => Float)
  @Property({ default: 0 })
  roundedPercent: number
}

@ObjectType()
export class PriceItem {
  @Field()
  @Property()
  label: string

  @Field(() => Float)
  @Property()
  price: number

  @Field(() => Float)
  @Property()
  cost: number
}

@ObjectType()
export class QuotationDetail extends PaymentAmounts {
  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  shippingPrices: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  additionalServices: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  discounts: PriceItem[]

  @Field(() => [PriceItem])
  @Property({ allowMixed: Severity.ALLOW })
  taxs: PriceItem[]
}
