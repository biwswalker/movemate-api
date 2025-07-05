import { EUserRole, EUserStatus } from '@enums/users'
import { createPubSub } from '@graphql-yoga/subscription'
import { Notification } from '@models/notification.model'
import { Shipment } from '@models/shipment.model'
import { LocationRequestLimitPayload } from '@payloads/location.payloads'
import { AdminNotificationCountPayload } from '@payloads/notification.payloads'

export const enum NOTFICATIONS {
  COUNT = 'COUNT',
  PROGRESSING_SHIPMENT = 'PROGRESSING_SHIPMENT',
  GET_MENU_BADGE_COUNT = 'GET_MENU_BADGE_COUNT',
  MESSAGE = 'MESSAGE',
  MESSAGE_GROUP = 'MESSAGE_GROUP',
}

export const enum SHIPMENTS {
  GET_MATCHING_SHIPMENT = 'GET_MATCHING_SHIPMENT',
  UPDATE = 'SHIPMENT_UPDATE',
}

export const enum LOCATIONS {
  REQUEST_LIMIT = 'REQUEST_LIMIT',
}

export const enum USERS {
  STATUS = 'STATUS',
  FORCE_LOGOUT = 'FORCE_LOGOUT',
}

export default createPubSub<{
  [NOTFICATIONS.MESSAGE]: [string, Notification]
  [NOTFICATIONS.MESSAGE_GROUP]: [EUserRole, Notification]
  [NOTFICATIONS.COUNT]: [string, number]
  [NOTFICATIONS.PROGRESSING_SHIPMENT]: [string, number]
  [NOTFICATIONS.GET_MENU_BADGE_COUNT]: [AdminNotificationCountPayload]
  [LOCATIONS.REQUEST_LIMIT]: [LocationRequestLimitPayload]
  [SHIPMENTS.GET_MATCHING_SHIPMENT]: [Shipment[]]
  [SHIPMENTS.UPDATE]: [string, Shipment]
  [USERS.STATUS]: [string, EUserStatus]
  [USERS.FORCE_LOGOUT]: [string, string]
}>()
