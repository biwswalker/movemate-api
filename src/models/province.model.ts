import { Field, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'

@ObjectType()
export class Province {
    @Field()
    @Property()
    id: number

    @Field()
    @Property()
    geographyId: number

    @Field()
    @Property()
    nameTh: string

    @Field()
    @Property()
    nameEn: string
}

const ProvinceModel = getModelForClass(Province)

export default ProvinceModel