import { ArgsType, Field, InputType } from "type-graphql";

@InputType()
class ServiceDescriptionInput {
    @Field()
    _id: string

    @Field()
    detail: string

    @Field(() => [String])
    vehicleTypes: string[]
}


@InputType()
export class AdditionalServiceInput {
    @Field()
    type: TServiceType;

    @Field()
    name: string;

    @Field()
    status: TServiceStatus;

    @Field(() => [ServiceDescriptionInput])
    descriptions: ServiceDescriptionInput[]
}

@ArgsType()
export class AdditionalServiceQueryArgs {
    @Field({ nullable: true })
    status: TServiceStatus;

    @Field({ nullable: true })
    name: string;
}