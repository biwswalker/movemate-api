import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass } from '@typegoose/typegoose'
import bcrypt from 'bcrypt'
import { Vehicle } from './vehicle.model'
import { DriverAgency } from './driverAgency.model'
import { IsEnum } from 'class-validator'

enum EDriverStatus {
    ACTIVE = 'active',
    BANNED = 'banned',
}

enum EUserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    WORKING = 'working',
}

// Rewrite ->


@ObjectType()
export class Driver {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true, unique: true })
    username: string

    @Property({ required: true })
    password: string

    @Field()
    @Property({ required: true })
    email: string

    @Field()
    @Property({ required: true })
    driver_number: string

    @Field()
    @Property({ required: true })
    name: string

    @Field(() => Vehicle)
    @Property({ ref: () => Vehicle })
    vehicle: Ref<Vehicle>

    @Field(() => [String])
    @Property({ required: true, allowMixed: Severity.ALLOW })
    phone_numbers: string[]

    @Field()
    @Property()
    line_id: string

    @Field()
    @IsEnum(EDriverStatus)
    @Property({ enum: EDriverStatus, default: EDriverStatus.ACTIVE })
    status: TUserStatus

    @Field()
    @Property({ enum: EUserStatus, default: EUserStatus.ACTIVE })
    working_status: TWorkingStatus

    @Field()
    @Property()
    driving_licence: string

    @Field()
    @Property({ required: true })
    driving_licence_expire: string

    @Field()
    @Property()
    criminal_history: string

    @Field(() => [DriverAgency])
    @Property({ ref: () => DriverAgency })
    agencies: Ref<DriverAgency[]>

    @Field()
    @Property({ required: true })
    identity_id: string

    @Field()
    @Property({ required: true })
    address: string

    @Field()
    @Property({ required: true })
    country: string

    @Field()
    @Property({ required: true })
    province: string

    @Field()
    @Property({ required: true })
    district: string

    @Field()
    @Property({ required: true })
    sub_district: string

    @Field()
    @Property({ required: true })
    postcode: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date

    async validatePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password)
    }

    static async findByUsername(username: string): Promise<Driver | null> {
        return DriverModel.findOne({ username })
    }
}

const DriverModel = getModelForClass(Driver)

export default DriverModel