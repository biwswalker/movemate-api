import { buildSchema } from 'type-graphql'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { Request, Response } from 'express'
import { get } from 'lodash'
import http from 'http'
import WebSocket from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { PubSub } from 'graphql-subscriptions';
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
import BillingCycleResolver from '@resolvers/billingCycle.resolvers'
import BillingPaymentResolver from '@resolvers/billingPayment.resolvers'
import TransactionResolver from '@resolvers/transaction.resolvers'

export interface GraphQLContext {
  req: Request
  res: Response
}


const pubSub = new PubSub()
export async function createGraphQLServer(httpServer: http.Server) {

  const schema = await buildSchema({
    resolvers: [
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
      BillingCycleResolver,
      BillingPaymentResolver,
      TransactionResolver,
    ],
    pubSub: pubSub as any,
    authChecker: ({ context }: { context: GraphQLContext }) => {
      const userId = get(context, 'req.userId', '')
      return !!userId
    },
  })

  const wsServer = new WebSocket.Server({ server: httpServer, path: '/subscription' })

  wsServer.on("connection", async (socket, request) => {
    // socket.close(1008, 'รหัสระบุตัวตนไม่สมบูรณ์');
    console.log("🧑🏻‍💻 New client connected")
    socket.on("error", (error) => console.log(`🐞 Error disconnected: ${error}`))
    socket.on("close", (code, error) => console.log(`❌ Client disconnected: ${code} - ${error}`))
  })

  useServer({ schema }, wsServer);

  const server = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  })

  return server
}
