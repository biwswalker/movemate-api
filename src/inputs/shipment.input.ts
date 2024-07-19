import { Field, Float, InputType } from "type-graphql";
import { FileInput } from "./file.input";
// import { GraphQLJSONObject } from "graphql-type-json";
import { LocationInput } from "./location.input";
import { PODAddressInput } from "./booking.input";

@InputType()
class DestinationInput {
    @Field()
    placeId: string

    @Field()
    name: string

    @Field()
    detail: string

    @Field(() => LocationInput)
    location: LocationInput

    @Field()
    contactName: string

    @Field()
    contactNumber: string

    @Field({ nullable: true })
    customerRemark: string
}

@InputType()
class PaymentDetailInput {
    @Field()
    name: string

    @Field()
    address: string

    @Field()
    province: string

    @Field()
    district: string

    @Field()
    subDistrict: string

    @Field()
    postcode: string

    @Field()
    contactNumber: string
}

@InputType()
class TransferPaymentDetailInput {
    @Field(() => FileInput)
    imageEvidence: FileInput

    @Field()
    bank: string

    @Field()
    bankName: string

    @Field()
    bankNumber: string

    @Field()
    paymentDate: Date

    @Field()
    paymentTime: Date
}

@InputType()
export class ShipmentInput {
    @Field(() => [DestinationInput])
    locations: DestinationInput[]

    @Field(() => Float)
    estimatedDistance: number

    @Field()
    estimatedTime: number

    @Field()
    isRoundedReturn: boolean

    @Field()
    vehicleId: string

    @Field({ nullable: true })
    favoriteDriverId?: string;

    @Field(() => [String], { nullable: true })
    additionalServices?: string[]

    @Field(() => PODAddressInput, { nullable: true })
    podDetail?: PODAddressInput

    @Field(() => String)
    paymentMethod: TPaymentMethod;

    @Field(() => PaymentDetailInput, { nullable: true })
    paymentDetail?: PaymentDetailInput;

    @Field(() => TransferPaymentDetailInput, { nullable: true })
    cashPaymentDetail?: TransferPaymentDetailInput;

    @Field({ nullable: true })
    discountId?: string;

    @Field()
    isBookingWithDate: boolean;

    @Field({ nullable: true })
    bookingDateTime?: Date;

    @Field(() => [FileInput], { nullable: true })
    additionalImage?: FileInput[]

    @Field({ nullable: true })
    refId?: string

    @Field({ nullable: true })
    remark?: string

    // @Field(() => GraphQLJSONObject)
    // directionRoutes: google.maps.DirectionsResult
    @Field()
    directionRoutes: string
}