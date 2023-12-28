import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { Agency } from "./agency.model"

@ObjectType()
export class DriverAgency {
    @Field(() => ID)
    readonly _id: string

    @Field(() => Agency)
    @Property({ ref: () => Agency })
    agency: Ref<Agency>

    @Field()
    @Property({ enum: [], default: ''}) // TODO:
    employment_type: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const DriverAgencyModel = getModelForClass(DriverAgency)

export default DriverAgencyModel