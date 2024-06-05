import { Field, Float, InputType } from "type-graphql";
import { FileInput } from "./file.input";

@InputType()
export class VehicleTypeInput {
    @Field()
    type: TVehicleType;

    @Field({ nullable: true })
    isPublic: boolean;

    @Field({ nullable: true })
    isLarger: boolean;

    @Field()
    name: string;

    @Field(() => Float)
    width: number;

    @Field(() => Float)
    length: number;

    @Field(() => Float)
    height: number;

    @Field(() => Float)
    maxCapacity: number;

    @Field(() => FileInput, { nullable: true })
    image: FileInput;

    @Field({ nullable: true })
    details: string;
}