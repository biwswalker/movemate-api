import { Field, InputType } from "type-graphql";

@InputType()
class ServiceDescriptionInput {
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