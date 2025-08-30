import { Resolver, Subscription, Root, SubscribeResolverData, Arg } from 'type-graphql'
import { DriverLocation } from '@payloads/tracking.payloads'
import { SHIPMENTS } from '@configs/pubsub'
import { AuthContext } from '@configs/graphQL.config'

@Resolver()
export default class TrackingSubscription {
  @Subscription({
    topics: SHIPMENTS.DRIVER_LOCATION,
    topicId: ({ args }: SubscribeResolverData<number, { shipmentId: string }, AuthContext>) => args.shipmentId,
  })
  onDriverLocationUpdate(@Root() payload: DriverLocation, @Arg('shipmentId') shipmentId: string): DriverLocation {
    return payload
  }
}
