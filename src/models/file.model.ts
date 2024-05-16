import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { Field, ObjectType, ID } from 'type-graphql'

@ObjectType()
export class File {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property({ required: true })
    fileId: string

    @Field()
    @Property({ required: true })
    filename: string

    @Field()
    @Property({ required: true })
    mimetype: string

    @Field()
    @Property({ default: Date.now })
    createdAt: Date

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date

    static async remove(fileId: string) {
        return FileModel.deleteOne({ fileId })
    }
}

const FileModel = getModelForClass(File)

export default FileModel