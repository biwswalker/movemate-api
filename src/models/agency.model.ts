import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class Agency {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    name: string

    @Field()
    @Property()
    description: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const AgencyModel = getModelForClass(Agency)

export default AgencyModel