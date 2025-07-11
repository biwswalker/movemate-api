import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { Field, ObjectType } from 'type-graphql'
import { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'

@ObjectType()
@plugin(mongooseAutoPopulate)
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
    email1: string

    @Field({ nullable: true })
    @Property()
    email1Detail: string

    @Field({ nullable: true })
    @Property()
    email2: string

    @Field({ nullable: true })
    @Property()
    email2Detail: string

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

    @Field({ nullable: true })
    @Property()
    linkedin: string

    @Field({ nullable: true })
    @Property()
    linkedinLink: string

    @Field(() => [UpdateHistory], { nullable: true })
    @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
    history: Ref<UpdateHistory>[];
}

const SettingContactUsModel = getModelForClass(SettingContactUs)

export default SettingContactUsModel