import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { Field, ObjectType, ID } from 'type-graphql'

@ObjectType()
export class SettingContactUs {
    @Field({ nullable: true })
    @Property()
    instructiontext: string

    @Field({ nullable: true })
    @Property()
    address: string

    @Field({ nullable: true })
    @Property()
    taxId: string

    @Field({ nullable: true })
    @Property()
    email: string

    @Field({ nullable: true })
    @Property()
    phoneNumber: string

    @Field({ nullable: true })
    @Property()
    facebook: string

    @Field({ nullable: true })
    @Property()
    facebookLink: string

    @Field({ nullable: true })
    @Property()
    lineId: string

    @Field({ nullable: true })
    @Property()
    lineLink: string
}

const SettingContactUsModel = getModelForClass(SettingContactUs)

export default SettingContactUsModel