import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { IsEnum } from "class-validator";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";

enum EPrivilegeType {
    BASIC = 'basic',
    STANDARD = 'standard',
    PREMIUM = 'premium',
}

enum EPrivilegeDiscountUnit {
    PERCENTAGE = 'percentage',
    CURRENCY = 'currency',
}

@ObjectType()
export class Privilege extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    name: string

    @Field()
    @Property({ required: true })
    code: string

    @Field()
    @IsEnum(EPrivilegeType)
    @Property({ enum: EPrivilegeType, required: true })
    type: TPrivilegeType

    @Field()
    @Property({ required: true })
    discount: number

    @Field()
    @IsEnum(EPrivilegeDiscountUnit)
    @Property({ enum: EPrivilegeDiscountUnit, required: true })
    unit: TPrivilegeDiscountUnit

    @Field()
    @Property({ required: true })
    description: string;

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const PrivilegeModel = getModelForClass(Privilege)

export default PrivilegeModel