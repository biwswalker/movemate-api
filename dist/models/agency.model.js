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
exports.Agency = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
let Agency = class Agency {
};
exports.Agency = Agency;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], Agency.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Agency.prototype, "name", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], Agency.prototype, "description", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Agency.prototype, "createdAt", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Agency.prototype, "updatedAt", void 0);
exports.Agency = Agency = __decorate([
    (0, type_graphql_1.ObjectType)()
], Agency);
const AgencyModel = (0, typegoose_1.getModelForClass)(Agency);
exports.default = AgencyModel;
//# sourceMappingURL=agency.model.js.map