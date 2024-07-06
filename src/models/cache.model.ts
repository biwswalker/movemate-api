import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass, index } from '@typegoose/typegoose'

@ObjectType()
@index({ key: 1 }, { unique: true })
export class Cache {
    @Field()
    @Property({ required: true })
    key: string

    @Field()
    @Property({ required: true })
    data: string;

    @Field()
    @Property({ required: true })
    timestamp: number
}

const CacheModel = getModelForClass(Cache)

export default CacheModel