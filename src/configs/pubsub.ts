import { createPubSub } from "@graphql-yoga/subscription";
import { AdminNotificationCountPayload } from "@payloads/notification.payloads";

export const enum NOTFICATIONS {
  GET_MENU_BADGE_COUNT = "GET_MENU_BADGE_COUNT",
}

export default createPubSub<{
  [NOTFICATIONS.GET_MENU_BADGE_COUNT]: [AdminNotificationCountPayload]
}>();