import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { sum } from 'lodash'
import { ObjectType, Field, ID, InputType } from 'type-graphql'

@ObjectType()
export class ShipmentPricing {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    discount_price: number

    @Field()
    @Property({ required: true })
    shipping_price: number

    @Field()
    @Property({ required: true })
    shipping_cost: number

    @Field()
    @Property({ required: true })
    handling_goods_driver_price: number

    @Field()
    @Property({ required: true })
    handling_goods_driver_cost: number

    @Field()
    @Property({ required: true })
    handling_goods_labor_price: number

    @Field()
    @Property({ required: true })
    handling_goods_labor_cost: number

    @Field()
    @Property({ required: true })
    pod_service_price_price: number

    @Field()
    @Property({ required: true })
    pod_service_price_cost: number

    @Field()
    @Property({ required: true })
    hold_pickup_price_price: number

    @Field()
    @Property({ required: true })
    hold_pickup_price_cost: number

    @Field()
    @Property({ required: true })
    service_vat_price: number

    @Field()
    @Property({ required: true })
    service_vat_cost: number

    @Field()
    @Property({ required: true })
    transport_wht_price: number

    @Field()
    @Property({ required: true })
    transport_wht_cost: number

    @Field()
    @Property({ required: true })
    service_wht_price: number

    @Field()
    @Property({ required: true })
    service_wht_cost: number

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date

    getTotal(): number {
        return sum([
            this.shipping_price,
            this.handling_goods_driver_price,
            this.handling_goods_labor_price,
            this.pod_service_price_price,
            this.hold_pickup_price_price,
            this.service_vat_price,
            this.transport_wht_price,
            this.service_wht_price,
            - this.discount_price
        ])
    }

    getCostTotal(): number {
        return sum([
            this.shipping_cost,
            this.handling_goods_driver_cost,
            this.handling_goods_labor_cost,
            this.pod_service_price_cost,
            this.hold_pickup_price_cost,
            this.service_vat_cost,
            this.transport_wht_cost,
            this.service_wht_cost,
        ])
    }
}

const ShipmentPricingModel = getModelForClass(ShipmentPricing)

export default ShipmentPricingModel

@InputType()
export class ShipmentPricingInput {
    @Field()
    shipping_price: number;

    @Field()
    shipping_cost: number;

    @Field()
    handling_goods_driver_price: number;

    @Field()
    handling_goods_driver_cost: number;

    @Field()
    handling_goods_labor_price: number;

    @Field()
    handling_goods_labor_cost: number;

    @Field()
    pod_service_price_price: number;

    @Field()
    pod_service_price_cost: number;

    @Field()
    hold_pickup_price_price: number;

    @Field()
    hold_pickup_price_cost: number;

    @Field()
    service_vat_price: number;

    @Field()
    service_vat_cost: number;

    @Field()
    transport_wht_price: number;

    @Field()
    transport_wht_cost: number;

    @Field()
    service_wht_price: number;

    @Field()
    service_wht_cost: number;
}
