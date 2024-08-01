import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class District {
    @Field()
    @Property()
    id: number

    @Field()
    @Property()
    provinceId: number

    @Field()
    @Property()
    nameTh: string

    @Field()
    @Property()
    nameEn: string
}

const DistrictModel = getModelForClass(District)

export default DistrictModel