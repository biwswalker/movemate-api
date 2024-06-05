import { Field, InputType } from "type-graphql"

@InputType()
export class FileInput {
    @Field()
    fileId: string;

    @Field()
    filename: string;

    @Field()
    mimetype: string;
}
