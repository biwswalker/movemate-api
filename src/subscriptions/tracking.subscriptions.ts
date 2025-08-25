import { Resolver, Subscription, Root } from 'type-graphql'
import { DriverLocation } from '@payloads/tracking.payloads'
import { SHIPMENTS } from '@configs/pubsub'

@Resolver()
export default class TrackingSubscription {
  @Subscription({ topics: SHIPMENTS.DRIVER_LOCATION })
  onDriverLocationUpdate(@Root() payload: DriverLocation): DriverLocation {
    return payload
  }
}
