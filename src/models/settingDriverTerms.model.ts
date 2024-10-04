import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { Field, ObjectType } from 'type-graphql'
import { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

@ObjectType()
@plugin(mongooseAutoPopulate)
export class SettingDriverTerms extends TimeStamps {
    @Field({ nullable: true })
    @Property()
    driverTerms: string

    @Field({ nullable: true })
    @Property()
    version: number

    @Field(() => [UpdateHistory], { nullable: true })
    @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
    history: Ref<UpdateHistory>[];

    @Field()
    @Property({ default: Date.now })
    createdAt: Date;

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date;
}

const SettingDriverTermsModel = getModelForClass(SettingDriverTerms)

export default SettingDriverTermsModel