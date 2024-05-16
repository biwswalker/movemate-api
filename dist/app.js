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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_handlebars_1 = require("express-handlebars");
require("reflect-metadata");
const mongodb_config_1 = require("./configs/mongodb.config");
const graphQL_config_1 = require("./configs/graphQL.config");
const auth_guards_1 = require("./guards/auth.guards");
const google_config_1 = __importDefault(require("./configs/google.config"));
const v1_1 = __importDefault(require("./apis/v1"));
const graphql_upload_ts_1 = require("graphql-upload-ts");
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const MaxUploadFileSize = 2 * 1024 * 1024;
function server() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = (0, express_1.default)();
        app.use((0, cors_1.default)());
        app.use(express_1.default.json());
        app.use(body_parser_1.default.urlencoded({ extended: false }));
        app.use((0, graphql_upload_ts_1.graphqlUploadExpress)({ maxFiles: 4, maxFileSize: MaxUploadFileSize }));
        app.use('/source', auth_guards_1.authenticateTokenAccessImage, express_1.default.static('uploads'));
        app.use('/assets', express_1.default.static('assets'));
        app.engine('hbs', (0, express_handlebars_1.engine)({ extname: '.hbs', defaultLayout: false }));
        app.set('view engine', 'hbs');
        yield (0, mongodb_config_1.connectToMongoDB)();
        const server = yield (0, graphQL_config_1.createGraphQLServer)();
        yield server.start();
        server.applyMiddleware({ app });
        yield (0, google_config_1.default)();
        app.use('/api/v1', v1_1.default);
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log('Server running on port: ', PORT);
        });
    });
}
server();
//# sourceMappingURL=app.js.map