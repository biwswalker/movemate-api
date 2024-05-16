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
Object.defineProperty(exports, "__esModule", { value: true });
const type_graphql_1 = require("type-graphql");
const auth_guards_1 = require("@guards/auth.guards");
const distanceMatrix_model_1 = require("@models/distanceMatrix.model");
const matrix_1 = require("@services/maps/matrix");
const lodash_1 = require("lodash");
let MapsResolver = class MapsResolver {
    distanceMatrix(lat, destinations) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { destinationAddresses, originAddresses, rows, status, } = yield (0, matrix_1.getDistanceMatrix)(lat, destinations);
                return {
                    destinationAddresses,
                    originAddresses,
                    status,
                    result: (0, lodash_1.get)(rows, '0.elements', []),
                };
            }
            catch (error) {
                throw new Error('Failed to excute distance matrix');
            }
        });
    }
};
__decorate([
    (0, type_graphql_1.Query)(() => distanceMatrix_model_1.DistanceMatrix),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Arg)('origin')),
    __param(1, (0, type_graphql_1.Arg)('destinations')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MapsResolver.prototype, "distanceMatrix", null);
MapsResolver = __decorate([
    (0, type_graphql_1.Resolver)()
], MapsResolver);
exports.default = MapsResolver;
//# sourceMappingURL=maps.resolvers.js.map