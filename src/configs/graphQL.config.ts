import http from 'http'
import WebSocket from 'ws'
import get from 'lodash/get'
import pubSub from './pubsub'
import { buildSchema } from 'type-graphql'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { Request, Response } from 'express'
import { useServer } from 'graphql-ws/lib/use/ws'
import { verifyAccessToken } from '@utils/auth.utils'
import { ClientSession } from 'mongoose'

import AuthResolver from '@resolvers/auth.resolvers'
import UserResolver from '@resolvers/user.resolvers'
import ShipmentResolver from '@resolvers/shipment.resolvers'
import FileResolver from '@resolvers/file.resolvers'
import AdminResolver from '@resolvers/admin.resolvers'
import RegisterResolver from '@resolvers/register.resolvers'
import VehicleTypeResolver from '@resolvers/vehicletype.resolvers'
import AdditionalServiceResolver from '@resolvers/additionalservice.resolvers'
import PricingResolver from '@resolvers/pricing.resolvers'
import BookingResolver from '@resolvers/booking.resolvers'
import SettingsResolver from '@resolvers/settings.resolvers'
import VerifyAccountResolver from '@resolvers/verify.resolvers'
import NotificationResolver from '@resolvers/notification.resolvers'
import LocationResolver from '@resolvers/location.resolvers'
import PrivilegeResolver from '@resolvers/privilege.resolvers'
import AddressResolver from '@resolvers/address.resolvers'
import OTPRequestResolver from '@resolvers/otp.resolvers'
import DriverResolver from '@resolvers/driver.resolvers'
import MatchingResolver from '@resolvers/matching.resolvers'
import TransactionResolver from '@resolvers/transaction.resolvers'
import CancellationResolver from '@resolvers/cancellation.resolvers'
import FavoriteDriverResolver from '@resolvers/favoritedrivers.resolvers'
import EventResolver from '@resolvers/event.resolvers'
import SearchHistoryResolver from '@resolvers/search.resolvers'
import DriverPaymentResolver from '@resolvers/driverpayment.resolvers'
import UserPendingResolver from '@resolvers/userPending.resolvers'
import BillingResolver from '@resolvers/billing.resolvers'
import PaymentResolver from '@resolvers/payment.resolvers'
import ContactResolver from '@resolvers/contact.resolvers'
import DashboardResolver from '@resolvers/dashboard.resolvers'
import ReportResolver from '@resolvers/report.resolvers'
import AuditLogResolver from '@resolvers/auditLog.resolvers'
import ControllResolver from '@resolvers/controll.resolvers'
import ControllSubscription from '@subscriptions/controll.subscriptions'
import ShipmentSubscription from '@subscriptions/shipment.subscriptions'

export interface GraphQLContext {
  req: Request
  res: Response
  ip: string
  pubsub: typeof pubSub
  session?: ClientSession
}

export interface AuthContext {
  user_id: string
  user_role: string
  ip: string
}

export async function createGraphQLServer(httpServer: http.Server) {
  const isProd = process.env.NODE_ENV === 'production'
  const schema = await buildSchema({
    resolvers: [
      /**
       * Resolvers
       */
      AuthResolver,
      UserResolver,
      ShipmentResolver,
      FileResolver,
      AdminResolver,
      RegisterResolver,
      VehicleTypeResolver,
      AdditionalServiceResolver,
      PricingResolver,
      BookingResolver,
      SettingsResolver,
      VerifyAccountResolver,
      NotificationResolver,
      LocationResolver,
      PrivilegeResolver,
      AddressResolver,
      OTPRequestResolver,
      DriverResolver,
      MatchingResolver,
      TransactionResolver,
      CancellationResolver,
      FavoriteDriverResolver,
      EventResolver,
      SearchHistoryResolver,
      DriverPaymentResolver,
      UserPendingResolver,
      BillingResolver,
      PaymentResolver,
      ContactResolver,
      DashboardResolver,
      ReportResolver,
      AuditLogResolver,
      ControllResolver,
      /**
       * Subscriptions
       */
      ControllSubscription,
      ShipmentSubscription,
    ],
    pubSub: pubSub,
    authChecker: ({ context }: { context: GraphQLContext }) => {
      const userId = get(context, 'req.user_id', '')
      return !!userId
    },
  })

  const wsServer = new WebSocket.Server({ server: httpServer, path: '/subscription' })

  wsServer.on('connection', async (socket, request) => {
    // socket.close(1008, 'รหัสระบุตัวตนไม่สมบูรณ์');
    console.log('🧑🏻‍💻 New client connected')
    socket.on('error', (error) => console.log(`🐞 Error disconnected: ${error}`))
    socket.on('close', (code, error) => console.log(`❌ Client disconnected: ${code} - ${error}`))
  })

  function getCookieValue(cookieString: string | undefined, cookieName: string): string | null {
    if (!cookieString) return null // Handle undefined or empty cookie string

    const cookies = cookieString.split('; ') // Split cookies by "; "

    for (const cookie of cookies) {
      const [name, value] = cookie.split('=') // Split each cookie into name and value
      if (name === cookieName && value) {
        return decodeURIComponent(value) // Return decoded value if found
      }
    }
    return null // Return null if cookie is not found
  }

  useServer(
    {
      schema,
      context: async (ctx, msg, args) => {
        const headers = get(ctx, 'extra.request.headers', {})
        const cookie = get(headers, 'cookie', '')
        const ip = get(headers, 'x-forwarded-for', '') || get(headers, 'x-real-ip', '') || '::1'
        console.log('x-forwarded-for context: ', ip)
        try {
          const authorizationFromConnectionParam = String(get(ctx, 'connectionParams.authorization', ''))
          const tokenFromConnectionParam = authorizationFromConnectionParam.split(' ')[1]
          const tokenFromCookie = getCookieValue(cookie, 'access_token') || undefined
          const token = tokenFromConnectionParam || tokenFromCookie
          if (token) {
            const decodedToken = verifyAccessToken(token)
            if (decodedToken) {
              const user_id = decodedToken.user_id
              const user_role = decodedToken.user_role
              return { user_id, user_role, ip }
            }
          }
          return { ip }
        } catch (error) {
          console.log('context error:', error)
          return { ip }
        }
      },
    },
    wsServer,
  )

  const server = new ApolloServer<GraphQLContext>({
    schema,
    introspection: !isProd,
    plugins: [
      ApolloServerPluginLandingPageDisabled(),
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              wsServer.close()
            },
          }
        },
      },
    ],
  })

  return server
}
