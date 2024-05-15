import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class FileUploadPayload {
    @Field()
    file_id: string

    @Field()
    filename: string

    @Field()
    mimetype: string

    @Field()
    url: string
}