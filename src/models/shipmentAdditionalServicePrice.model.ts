import { Field, Float, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { AdditionalServiceCostPricing } from './additionalServiceCostPricing.model'
import get from 'lodash/get'
import { AdditionalService } from './additionalService.model'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class ShipmentAdditionalServicePrice extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => AdditionalServiceCostPricing)
  @Property({ required: true, autopopulate: true, ref: () => AdditionalServiceCostPricing })
  reference: Ref<AdditionalServiceCostPricing>

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

  @Field({ nullable: true })
  get name(): string {
    const serviceName = get(this, '_doc.reference.additionalService.name', '') || this.reference || ''
    if (serviceName) {
      if (typeof serviceName === 'string') {
        return serviceName
      }
      const ref = serviceName as AdditionalServiceCostPricing
      if (ref.additionalService) {
        const service = ref.additionalService as AdditionalService
        return service.name
      }
    }
    return ''
  }
}

const ShipmentAdditionalServicePriceModel = getModelForClass(ShipmentAdditionalServicePrice)

export default ShipmentAdditionalServicePriceModel
