import { createPubSub } from '@graphql-yoga/subscription'
import { Shipment } from '@models/shipment.model'
import { LocationRequestLimitPayload } from '@payloads/location.payloads'
import { AdminNotificationCountPayload } from '@payloads/notification.payloads'

export const enum NOTFICATIONS {
  GET_MENU_BADGE_COUNT = 'GET_MENU_BADGE_COUNT',
}

export const enum SHIPMENTS {
  GET_MATCHING_SHIPMENT = 'GET_MATCHING_SHIPMENT',
}

export const enum LOCATIONS {
  REQUEST_LIMIT = 'REQUEST_LIMIT',
}

export default createPubSub<{
  [NOTFICATIONS.GET_MENU_BADGE_COUNT]: [AdminNotificationCountPayload]
  [LOCATIONS.REQUEST_LIMIT]: [LocationRequestLimitPayload]
  [SHIPMENTS.GET_MATCHING_SHIPMENT]: [Shipment[]]
}>()