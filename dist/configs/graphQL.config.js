"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphQLServer = void 0;
const type_graphql_1 = require("type-graphql");
const apollo_server_express_1 = require("apollo-server-express");
const lodash_1 = require("lodash");
const auth_resolvers_1 = __importDefault(require("../resolvers/auth.resolvers"));
const user_resolvers_1 = __importDefault(require("../resolvers/user.resolvers"));
const shipment_resolvers_1 = __importDefault(require("../resolvers/shipment.resolvers"));
const maps_resolvers_1 = __importDefault(require("../resolvers/maps.resolvers"));
const file_resolvers_1 = __importDefault(require("../resolvers/file.resolvers"));
const ping_resolvers_1 = __importDefault(require("../resolvers/ping.resolvers"));
function createGraphQLServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const schema = yield (0, type_graphql_1.buildSchema)({
            resolvers: [auth_resolvers_1.default, user_resolvers_1.default, shipment_resolvers_1.default, maps_resolvers_1.default, file_resolvers_1.default, ping_resolvers_1.default],
            authChecker: ({ context }) => {
                const userId = (0, lodash_1.get)(context, 'req.userId', '');
                return !!userId;
            }
        });
        const server = new apollo_server_express_1.ApolloServer({
            schema,
            context: ({ req, res }) => ({ req, res }),
        });
        return server;
    });
}
exports.createGraphQLServer = createGraphQLServer;
//# sourceMappingURL=graphQL.config.js.map