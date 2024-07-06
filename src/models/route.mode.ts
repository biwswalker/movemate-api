import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Severity, getModelForClass } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"

@ObjectType()
export class Route extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property()
    distance: string;

    @Field()
    @Property()
    duration: string;

    @Field()
    @Property()
    endAddress: string;

    @Field()
    @Property()
    startAddress: string;

    @Field(() => [String])
    @Property({ allowMixed: Severity.ALLOW })
    steps: string[];

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date
}

const RouteModel = getModelForClass(Route)

export default RouteModel