import { Resolver, Query, UseMiddleware, Arg, Mutation } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { DistanceMatrix } from '@models/distanceMatrix.model'
import { getDistanceMatrix } from '@services/maps/matrix'
import { File } from '@models/file.model'

@Resolver()
export default class MapsResolver {
    @Mutation(() => File)
    async file_upload(@Arg('file', () => GraphQLUpload) file: Express.Multer.File): Promise<File> {
        return {
            filename: file.filename,
            mimetype: file.mimetype,
            encoding: file.encoding,
        };
    }
}