import { Field, ObjectType } from 'type-graphql'

@ObjectType()
export class File {
    @Field()
    file_id: string

    @Field()
    filename: string

    @Field()
    mimetype: string

    @Field()
    url: string
}