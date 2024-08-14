import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import { User } from "./user.model"

@ObjectType()
export class PODAddress extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field(() => User)
    @Property({ required: true, ref: 'User' })
    user: Ref<User>

    @Field()
    @Property({ required: true })
    fullname: string

    @Field()
    @Property({ required: true })
    address: string

    @Field()
    @Property({ required: true })
    province: string;

    @Field()
    @Property({ required: true })
    district: string;

    @Field()
    @Property({ required: true })
    subDistrict: string;

    @Field()
    @Property({ required: true })
    postcode: string;

    @Field()
    @Property({ required: true })
    phoneNumber: string

    @Field({ nullable: true })
    @Property()
    remark: string;

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const PODAddressModel = getModelForClass(PODAddress)

export default PODAddressModel