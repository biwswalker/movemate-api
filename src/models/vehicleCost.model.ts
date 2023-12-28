import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class VehicleCost {
    @Field(() => ID)
    readonly _id: string
  
    @Field()
    @Property({ required: true })
    shiping_rate: number;
  
    @Field()
    @Property({ required: true })
    shiping_rate_cost: number;
  
    @Field()
    @Property({ required: true })
    handling_goods_driver: number;
  
    @Field()
    @Property({ required: true })
    handling_goods_driver_cost: number;
  
    @Field()
    @Property({ required: true })
    handling_goods_labor: number;
  
    @Field()
    @Property({ required: true })
    handling_goods_labor_cost: number;
  
    @Field()
    @Property({ required: true })
    pod_service_price: number;
  
    @Field()
    @Property({ required: true })
    pod_service_price_cost: number;
  
    @Field()
    @Property({ required: true })
    hold_pickup_price: number;
  
    @Field()
    @Property({ required: true })
    hold_pickup_price_cost: number;
  
    @Field()
    @Property({ required: true })
    service_vat: number;
  
    @Field()
    @Property({ required: true })
    service_vat_cost: number;
  
    @Field()
    @Property({ required: true })
    transpot_wht: number;
  
    @Field()
    @Property({ required: true })
    transpot_wht_cost: number;
  
    @Field()
    @Property({ required: true })
    service_wht: number;
  
    @Field()
    @Property({ required: true })
    service_wht_cost: number;
  

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const VehicleCostModel = getModelForClass(VehicleCost)

export default VehicleCostModel