import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { get } from 'lodash'
import { Field, ObjectType, ID } from 'type-graphql'

@ObjectType()
export class DirectionsResult {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    rawData: string
}

const DirectionsResultModel = getModelForClass(DirectionsResult)

export default DirectionsResultModel