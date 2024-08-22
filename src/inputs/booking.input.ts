import { ArgsType, Field, Float, InputType, Int } from "type-graphql"

@InputType()
export class PODAddressInput {
    @Field({ nullable: true })
    _id?: string

    @Field()
    fullname: string

    @Field()
    address: string

    @Field()
    province: string;

    @Field()
    district: string;

    @Field()
    subDistrict: string;

    @Field()
    postcode: string;

    @Field()
    phoneNumber: string

    @Field({ nullable: true })
    remark?: string
}

@ArgsType()
export class SubtotalCalculationArgs {
    @Field(() => Int)
    dropPoint: number

    @Field(() => Float)
    distanceMeter: number

    @Field(() => Float)
    distanceReturnMeter: number

    @Field(() => Boolean)
    isRounded: boolean

    @Field()
    vehicleTypeId: string

    @Field(() => [String], { nullable: true })
    serviceIds?: string[]

    @Field({ nullable: true })
    discountId?: string

    @Field()
    isBusinessCashPayment: boolean
}
