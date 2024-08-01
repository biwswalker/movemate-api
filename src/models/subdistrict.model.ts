import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class SubDistrict {
    @Field()
    @Property()
    id: number

    @Field()
    @Property()
    amphureId: number

    @Field()
    @Property()
    zipCode: number

    @Field()
    @Property()
    nameTh: string

    @Field()
    @Property()
    nameEn: string
}

const SubDistrictModel = getModelForClass(SubDistrict)

export default SubDistrictModel