import { Field, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, Severity, getModelForClass } from '@typegoose/typegoose'
import { VehicleType } from "./vehicleType.model"
@ObjectType()
export class Vehicle {
    @Field(() => ID)
    readonly _id: string

    @Field(() => VehicleType)
    @Property({ required: true, allowMixed: Severity.ALLOW })
    type: Ref<VehicleType>

    @Field()
    @Property()
    model: string

    @Field()
    @Property({ required: true })
    license_plate: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date
}

const VehicleModel = getModelForClass(Vehicle)

export default VehicleModel