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
exports.authenticateTokenAccessImage = exports.AuthGuard = void 0;
const type_graphql_1 = require("type-graphql");
const auth_utils_1 = require("@utils/auth.utils");
const user_model_1 = __importDefault(require("@models/user.model"));
const jsonwebtoken_1 = require("jsonwebtoken");
const findUserById = (Model, user_id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield Model.findById(user_id);
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
});
const AuthGuard = (_a, next_1) => __awaiter(void 0, [_a, next_1], void 0, function* ({ context }, next) {
    const { req } = context;
    const authorization = req.headers['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new type_graphql_1.AuthenticationError('รหัสระบุตัวตนไม่สมบูรณ์');
    }
    try {
        const token = authorization.split(' ')[1];
        const decodedToken = (0, auth_utils_1.verifyAccessToken)(token);
        if (!decodedToken) {
            throw new type_graphql_1.AuthenticationError('รหัสระบุตัวตนไม่สมบูรณ์หรือหมดอายุ');
        }
        const user_id = decodedToken.user_id;
        const user = yield findUserById(user_model_1.default, user_id);
        if (!user) {
            throw new type_graphql_1.AuthenticationError('ไม่พบผู้ใช้');
        }
        req.user_id = user_id;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.TokenExpiredError) {
            throw new type_graphql_1.AuthenticationError('เซสชั่นหมดอายุ');
        }
        throw error;
    }
    return next();
});
exports.AuthGuard = AuthGuard;
const authenticateTokenAccessImage = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authorization = request.headers['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ') || authorization === undefined || authorization === null) {
        return response.sendStatus(401);
    }
    try {
        const token = authorization.split(' ')[1];
        const decodedToken = (0, auth_utils_1.verifyAccessToken)(token);
        if (!decodedToken) {
            return response.sendStatus(403);
        }
        const user_id = decodedToken.user_id;
        const user = yield findUserById(user_model_1.default, user_id);
        if (!user) {
            return response.sendStatus(403);
        }
        next();
    }
    catch (error) {
        // console.log(error)
        return response.sendStatus(403);
    }
});
exports.authenticateTokenAccessImage = authenticateTokenAccessImage;
//# sourceMappingURL=auth.guards.js.map