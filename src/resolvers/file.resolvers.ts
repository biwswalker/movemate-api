import { Resolver, Arg, Mutation, UseMiddleware, Ctx } from 'type-graphql'
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts'
import { createWriteStream } from 'fs'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { generateId, generateRandomNumberPattern } from '@utils/string.utils'
import { extname, join } from 'path'
import { FileUploadPayload } from '@payloads/file.payloads'
import { get } from 'lodash'

@Resolver()
export default class MapsResolver {

    @Mutation(() => FileUploadPayload)
    // @UseMiddleware(AuthGuard) // TODO: Must fixed request url source
    async file_upload(@Arg('file', () => GraphQLUpload) file: FileUpload, @Ctx() ctx: GraphQLContext): Promise<FileUploadPayload> {
        // const userId = ctx.req.user_id
        const { filename, mimetype, createReadStream } = await file
        const generated_filename = await generateId(`${generateRandomNumberPattern('MMSOURCE######')}-`, 'upload')
        const final_filename = `${generated_filename}${extname(filename)}`
        const path = join(__dirname, '..', '..', 'uploads', final_filename)
        const protocol = get(ctx, 'req.protocol', '')
        const host = ctx.req.get('host')
        const url = `${protocol}://${host}/source/${final_filename}`

        return await new Promise<FileUploadPayload>((resolve, reject) => {
            createReadStream()
                .pipe(createWriteStream(path))
                .on('finish', async () => {
                    resolve({
                        fileId: generated_filename,
                        filename: final_filename,
                        mimetype,
                        url
                    })
                })
                .on('error', (error) => {
                    console.log('error: ', error)
                    reject()
                })
        })
    }
}
