import express from "express";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { expressMiddleware } from '@apollo/server/express4';
import { connectToMongoDB } from "@configs/mongodb.config";
import { createGraphQLServer } from "@configs/graphQL.config";
import { authenticateTokenAccessImage } from "@guards/auth.guards";
import { graphqlUploadExpress } from "graphql-upload-ts";
import initialGoogleOAuth from "@configs/google.config";
import api_v1 from "@apis/v1";
import bodyParser from "body-parser";
import morgan from 'morgan'
import cors from "cors";
import http from 'http'
import "reflect-metadata";

dotenv.config();

const MaxUploadFileSize = 2 * 1024 * 1024;

async function server() {
  const app = express();
  const httpServer = http.createServer(app)
  const alllowedCors = cors<cors.CorsRequest>()
  app.use(alllowedCors);
  app.use(express.json());
  app.use(morgan('short'))
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(graphqlUploadExpress({ maxFiles: 4, maxFileSize: MaxUploadFileSize }));
  app.use("/source", authenticateTokenAccessImage, express.static("uploads"));
  app.use("/assets", express.static("assets"));

  app.engine("hbs", engine({ extname: ".hbs", defaultLayout: false }));
  app.set("view engine", "hbs");

  // GrapQL Server
  const server = await createGraphQLServer(httpServer);

  await connectToMongoDB();
  await server.start();
  await initialGoogleOAuth();

  app.use('/graphql', alllowedCors, express.json(), expressMiddleware(server, {
    context: async ({ req, res }) => ({ req, res }),
  }))
  app.use("/v1", api_v1);

  const PORT = process.env.API_PORT || 5000;
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`🚀 Server ready at :`, httpServer.address());
}

server();
