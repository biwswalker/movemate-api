import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { IsEnum } from "class-validator";

enum EPrivilegeType {
    BASIC = 'BASIC',
    STANDARD = 'STANDARD',
    PREMIUM = 'PREMIUM',
}

enum EPrivilegeDiscountUnit {
    PERCENTAGE = 'PERCENTAGE',
    CURRENCY = 'CURRENCY',
}

@ObjectType()
export class Privilege {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    name: string

    @Field()
    @IsEnum(EPrivilegeType)
    @Property({ enum: EPrivilegeType, required: true })
    type: TPrivilegeType

    @Field()
    @Property({ required: true })
    discount_number: number

    @Field()
    @IsEnum(EPrivilegeDiscountUnit)
    @Property({ enum: EPrivilegeDiscountUnit, required: true })
    discount_unit: TPrivilegeDiscountUnit

    @Field()
    @Property({ required: true })
    description: string;

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const PrivilegeModel = getModelForClass(Privilege)

export default PrivilegeModel