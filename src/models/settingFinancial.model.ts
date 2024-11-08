import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { Field, ObjectType } from 'type-graphql'
import { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

@ObjectType()
@plugin(mongooseAutoPopulate)
export class SettingFinancial extends TimeStamps {
    @Field({ nullable: true })
    @Property()
    promptpay: string

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

const SettingFinancialModel = getModelForClass(SettingFinancial)

export default SettingFinancialModel