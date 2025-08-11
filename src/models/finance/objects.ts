import { Field, Float, ObjectType } from 'type-graphql'
import { prop as Property, Severity } from '@typegoose/typegoose'
import { EBillingReason, EPriceItemType } from '@enums/billing'

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

  refId?: string
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

@ObjectType()
export class PriceEditorItem {
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

@ObjectType()
export class QuotationEditorDetail {
  @Field(() => PriceEditorItem)
  shipping: PriceEditorItem

  @Field(() => PriceEditorItem, { nullable: true })
  rounded?: PriceEditorItem

  @Field(() => [PriceEditorItem], { nullable: true, defaultValue: [] })
  services?: PriceEditorItem[]

  @Field(() => PriceEditorItem, { nullable: true })
  discount?: PriceEditorItem

  @Field(() => PriceEditorItem, { nullable: true })
  taxs?: PriceEditorItem

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
