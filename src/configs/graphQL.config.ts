import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import { Request, Response } from "express";
import { get } from "lodash";
import AuthResolver from '@resolvers/auth.resolvers'
import UserResolver from '@resolvers/user.resolvers'
import ShipmentResolver from "@resolvers/shipment.resolvers";
import MapsResolver from "@resolvers/maps.resolvers";

export interface GraphQLContext {
    req: Request
    res: Response
}

export async function createGraphQLServer() {
    const schema = await buildSchema({
        resolvers: [AuthResolver, UserResolver, ShipmentResolver, MapsResolver],
        authChecker: ({ context }: { context: GraphQLContext }) => {
            const userId = get(context, 'req.userId', '')
            return !!userId
        }
    })

    const server = new ApolloServer<GraphQLContext>({
        schema,
        context: ({ req, res }) => ({ req, res }),
    })

    return server
}