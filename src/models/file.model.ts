import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { Field, ObjectType, ID } from 'type-graphql'

@ObjectType()
export class File {
    @Field()
    @Property({ required: true, unique: true })
    file_id: string

    @Field()
    @Property({ required: true })
    filename: string

    @Field()
    @Property({ required: true })
    mimetype: string

    @Field()
    @Property({ default: Date.now })
    created_at: Date

    @Field()
    @Property({ default: Date.now })
    updated_at: Date

    static async remove(file_id: string) {
        return FileModel.deleteOne({ file_id })
    }
}

const FileModel = getModelForClass(File)

export default FileModel