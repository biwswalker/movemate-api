import { createPubSub } from '@graphql-yoga/subscription'
import { LocationRequestLimitPayload } from '@payloads/location.payloads'
import { AdminNotificationCountPayload } from '@payloads/notification.payloads'

export const enum NOTFICATIONS {
  GET_MENU_BADGE_COUNT = 'GET_MENU_BADGE_COUNT',
}

export const enum LOCATIONS {
  REQUEST_LIMIT = 'REQUEST_LIMIT',
}

export default createPubSub<{
  [NOTFICATIONS.GET_MENU_BADGE_COUNT]: [AdminNotificationCountPayload]
  [LOCATIONS.REQUEST_LIMIT]: [LocationRequestLimitPayload]
}>()
