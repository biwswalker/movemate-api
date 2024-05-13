import { Resolver, Arg, Mutation, UseMiddleware, Ctx } from 'type-graphql'
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts'
import { File } from '@models/file.model'
import { createWriteStream } from 'fs'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { generateId } from '@utils/string.utils'
import { extname, join } from 'path'

@Resolver()
export default class MapsResolver {

    @Mutation(() => (File))
    @UseMiddleware(AuthGuard)
    async file_upload(@Arg('file', () => GraphQLUpload) file: FileUpload, @Ctx() ctx: GraphQLContext): Promise<File> {
        const userId = ctx.req.user_id
        const { filename, mimetype, createReadStream } = await file
        const generated_filename = await generateId(`${userId}-`, 'upload')
        const final_filename = `${generated_filename}${extname(filename)}`
        const path = join(__dirname, '..', '..', 'uploads', final_filename)

        await new Promise((resolve, reject) => {
            createReadStream()
                .pipe(createWriteStream(path))
                .on('finish', () => resolve(true))
                .on('error', (gg) => {
                    console.log('error: ', gg)
                    reject()
                })
        })

        const url = `${process.env.DOMAINNAME}/source/${final_filename}`

        return {
            file_id: generated_filename,
            url: url,
            mimetype,
            filename: final_filename
        }
    }
}