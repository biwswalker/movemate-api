"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
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
const type_graphql_1 = require("type-graphql");
const user_model_1 = require("@models/user.model");
const user_payloads_1 = require("@payloads/user.payloads");
const auth_utils_1 = require("@utils/auth.utils");
const graphql_1 = require("graphql");
const customerIndividual_model_1 = __importDefault(require("@models/customerIndividual.model"));
const customerBusiness_model_1 = __importDefault(require("@models/customerBusiness.model"));
let AuthResolver = class AuthResolver {
    login(username, password, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findByUsername(username);
                if (!user || !user.validatePassword(password)) {
                    throw new graphql_1.GraphQLError('บัญชีหรือรหัสผ่านผิด โปรดลองใหม่อีกครั้ง');
                }
                const token = (0, auth_utils_1.generateAccessToken)(user._id);
                ctx.res.cookie('access_token', token, { httpOnly: true });
                if (user.userType === 'individual') {
                    const individualDetail = yield customerIndividual_model_1.default.findByUserNumber(user.userNumber);
                    return {
                        token,
                        detail: {
                            user,
                            individualDetail
                        },
                    };
                }
                else if (user.userType === 'business') {
                    const businessDetail = yield customerBusiness_model_1.default.findByUserNumber(user.userNumber);
                    return {
                        token,
                        detail: {
                            user,
                            businessDetail
                        },
                    };
                }
                return {
                    token,
                    detail: {
                        user,
                    },
                };
            }
            catch (error) {
                console.log(error);
                throw error;
            }
        });
    }
    logout(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            // Clear access token by removing the cookie
            ctx.res.clearCookie('access_token');
            return true;
        });
    }
};
__decorate([
    (0, type_graphql_1.Mutation)(() => user_payloads_1.AuthPayload),
    __param(0, (0, type_graphql_1.Arg)('username')),
    __param(1, (0, type_graphql_1.Arg)('password')),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AuthResolver.prototype, "login", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthResolver.prototype, "logout", null);
AuthResolver = __decorate([
    (0, type_graphql_1.Resolver)()
], AuthResolver);
exports.default = AuthResolver;
//# sourceMappingURL=auth.resolvers.js.map