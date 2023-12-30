import { Field, InputType } from 'type-graphql'

@InputType()
class UploadFileInput {
    @Field(() => GraphQLUpload)
    file: Express.Multer.File;
}