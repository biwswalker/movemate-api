import { buildSchema } from "type-graphql";
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { Request, Response } from "express";
import { get } from "lodash";
import http from 'http'
import AuthResolver from '@resolvers/auth.resolvers'
import UserResolver from '@resolvers/user.resolvers'
import ShipmentResolver from "@resolvers/shipment.resolvers";
import MapsResolver from "@resolvers/maps.resolvers";
import FileResolver from "@resolvers/file.resolvers";
import PingResolver from "@resolvers/ping.resolvers";
import AdminResolver from "@resolvers/admin.resolvers";
import RegisterResolver from "@resolvers/register.resolvers";
import VehicleTypeResolver from "@resolvers/vehicletype.resolvers";

export interface GraphQLContext {
    req: Request
    res: Response
}

export async function createGraphQLServer(httpServer: http.Server) {
    const schema = await buildSchema({
        resolvers: [
            AuthResolver,
            UserResolver,
            ShipmentResolver,
            MapsResolver,
            FileResolver,
            PingResolver,
            AdminResolver,
            RegisterResolver,
            VehicleTypeResolver,
        ],
        authChecker: ({ context }: { context: GraphQLContext }) => {
            const userId = get(context, 'req.userId', '')
            return !!userId
        }
    })

    const server = new ApolloServer<GraphQLContext>({
        schema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    })

    return server
}