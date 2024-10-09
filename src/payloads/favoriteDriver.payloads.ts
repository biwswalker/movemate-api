import { User } from '@models/user.model'
import { ObjectType, Field } from 'type-graphql'

@ObjectType()
export class FavoriteDriverPayload extends User {
  @Field()
  acceptedWork: number

  @Field()
  cancelledWork: number
}
