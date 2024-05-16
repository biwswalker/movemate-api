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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthPayload = exports.UserPayload = void 0;
const type_graphql_1 = require("type-graphql");
const user_model_1 = require("../models/user.model");
const customerIndividual_model_1 = require("../models/customerIndividual.model");
const customerBusiness_model_1 = require("../models/customerBusiness.model");
let UserPayload = class UserPayload {
};
exports.UserPayload = UserPayload;
__decorate([
    (0, type_graphql_1.Field)(() => user_model_1.User),
    __metadata("design:type", user_model_1.User)
], UserPayload.prototype, "user", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => customerIndividual_model_1.IndividualCustomer, { nullable: true }),
    __metadata("design:type", customerIndividual_model_1.IndividualCustomer)
], UserPayload.prototype, "individualDetail", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => customerBusiness_model_1.BusinessCustomer, { nullable: true }),
    __metadata("design:type", customerBusiness_model_1.BusinessCustomer)
], UserPayload.prototype, "businessDetail", void 0);
exports.UserPayload = UserPayload = __decorate([
    (0, type_graphql_1.ObjectType)()
], UserPayload);
let AuthPayload = class AuthPayload {
};
exports.AuthPayload = AuthPayload;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], AuthPayload.prototype, "token", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => UserPayload),
    __metadata("design:type", UserPayload)
], AuthPayload.prototype, "detail", void 0);
exports.AuthPayload = AuthPayload = __decorate([
    (0, type_graphql_1.ObjectType)()
], AuthPayload);
//# sourceMappingURL=user.payloads.js.map