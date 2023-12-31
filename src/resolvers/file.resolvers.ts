import { Resolver, Arg, Mutation } from 'type-graphql'
import { GraphQLUpload, FileUpload } from 'graphql-upload'
import { File } from '@models/file.model'

@Resolver()
export default class MapsResolver {
    @Mutation(() => File)
    async file_upload(@Arg('file', () => GraphQLUpload) file: FileUpload): Promise<FileUpload> {
        const { filename, mimetype, encoding, createReadStream } = await file
        console.log(`Received file: ${filename}, mimetype: ${mimetype}, encoding: ${encoding}`);
        return {
            filename,
            mimetype,
            encoding,
            createReadStream
        }
    }
}