import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { Agency } from "./agency.model"

// Rewrite ->

@ObjectType()
export class DriverAgency {
    @Field(() => ID)
    readonly _id: string

    @Field(() => Agency)
    @Property({ ref: () => Agency })
    agency: Ref<Agency>

    @Field()
    @Property({ enum: [], default: ''}) // TODO:
    employmentType: string

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const DriverAgencyModel = getModelForClass(DriverAgency)

export default DriverAgencyModel