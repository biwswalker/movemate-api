import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class FileUploadPayload {
    @Field()
    fileId: string

    @Field()
    filename: string

    @Field()
    mimetype: string

    @Field()
    url: string
}