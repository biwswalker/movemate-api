import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsString, Length } from 'class-validator'
import { VehicleType } from './vehicleType.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { DriverDocument } from './driverDocument.model'
import { get } from 'lodash'

@plugin(mongooseAutoPopulate)
@ObjectType()
export class IndividualDriver {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsString()
    @Property()
    title: string;

    @Field()
    @IsString()
    @Property()
    otherTitle: string;

    @Field()
    @IsString()
    @Property()
    firstname: string;

    @Field()
    @IsString()
    @Property()
    lastname: string;

    @Field()
    @IsString()
    @Length(13)
    @Property()
    taxId: string;

    @Field()
    @Property()
    phoneNumber: string;

    @Field()
    @Property()
    lineId: string;

    @Field()
    @IsString()
    @Property()
    address: string;

    @Field()
    @Property()
    province: string;

    @Field()
    @IsString()
    @Property()
    district: string;

    @Field()
    @IsString()
    @Property()
    subDistrict: string;

    @Field()
    @IsString()
    @Property()
    postcode: string;

    @Field()
    @IsString()
    @Property()
    bank: string

    @Field()
    @IsString()
    @Property()
    bankBranch: string;

    @Field()
    @IsString()
    @Property()
    bankName: string;

    @Field()
    @IsString()
    @Property()
    bankNumber: string;

    @Field(() => VehicleType)
    @Property({ autopopulate: true, ref: 'VehicleType' })
    serviceVehicleType: Ref<VehicleType>

    @Field(() => DriverDocument)
    @Property({ autopopulate: true, ref: 'DriverDocument' })
    documents: Ref<DriverDocument>

    @Field({ nullable: true })
    get fullname(): string {
        const title = get(this, '_doc.title', '') || get(this, 'title', '')
        const otherTitle = get(this, '_doc.otherTitle', '') || get(this, 'otherTitle', '')
        const firstname = get(this, '_doc.firstname', '') || get(this, 'firstname', '')
        const lastname = get(this, '_doc.lastname', '') || get(this, 'lastname', '')
        return `${title || otherTitle} ${firstname} ${lastname}`;
    }
}

const IndividualDriverModel = getModelForClass(IndividualDriver)

export default IndividualDriverModel