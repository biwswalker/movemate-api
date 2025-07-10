import { AuthContext } from '@configs/graphQL.config'
import { USERS } from '@configs/pubsub'
import { Ctx, Resolver, Root, SubscribeResolverData, Subscription } from 'type-graphql'

@Resolver()
export default class ControllSubscription {
  @Subscription({
    topics: USERS.FORCE_LOGOUT,
    topicId: ({ context }: SubscribeResolverData<number, any, AuthContext>) => context.user_id,
  })
  forceLogout(@Root() payload: string, @Ctx() _: AuthContext): string {
    return payload
  }
}
