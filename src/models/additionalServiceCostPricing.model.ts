import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { AdditionalService } from "./additionalService.model";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { IsEnum, IsNotEmpty } from "class-validator";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { get, map, reduce, sum } from "lodash";
import { PriceItem } from "@payloads/booking.payloads";

enum EAdditionalServiceCostPricingUnit {
    PERCENT = "percent",
    CURRENCY = "currency",
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class AdditionalServiceCostPricing extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    available: boolean

    @Field(() => AdditionalService)
    @Property({ required: true, autopopulate: true, ref: () => AdditionalService })
    additionalService: Ref<AdditionalService>

    @Field()
    @IsEnum(EAdditionalServiceCostPricingUnit)
    @IsNotEmpty()
    @Property({ enum: EAdditionalServiceCostPricingUnit, default: EAdditionalServiceCostPricingUnit.PERCENT, required: true })
    type: TAdditionalServiceCostPricingUnit

    @Field(() => Float)
    @Property({ required: true })
    cost: number

    @Field(() => Float)
    @Property({ required: true })
    price: number

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date

    static async getServicesPricing(ids: string[], costCalculation: boolean = false): Promise<{ additionalServices: AdditionalServiceCostPricing[], priceItems: PriceItem[], price: number, cost: number }> {
        const additionalServices = await AdditionalServiceCostPricingModel.find({ _id: { $in: ids } }).exec();
        const servicePrices = map<AdditionalServiceCostPricing, PriceItem>(additionalServices, service => {
            const serviceName = get(service, 'additionalService.name', '')
            if (serviceName === 'POD') {
                return ({ label: `บริการคืนใบส่งสินค้า (${serviceName})`, price: service.price, cost: costCalculation ? service.cost : 0 })
            }
            return ({ label: serviceName, price: service.price, cost: costCalculation ? service.cost : 0 })
        })
        const { price, cost } = reduce(servicePrices, (prev, curr) => {
            return { ...prev, price: sum([prev.price, curr.price]), cost: sum([prev.cost, curr.cost]) }
        }, { cost: 0, price: 0 })
        return {
            additionalServices,
            priceItems: servicePrices,
            price,
            cost
        };
    }
}

const AdditionalServiceCostPricingModel = getModelForClass(AdditionalServiceCostPricing)

export default AdditionalServiceCostPricingModel