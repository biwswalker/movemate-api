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
exports.DriverAgency = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const agency_model_1 = require("./agency.model");
let DriverAgency = class DriverAgency {
};
exports.DriverAgency = DriverAgency;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], DriverAgency.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => agency_model_1.Agency),
    (0, typegoose_1.prop)({ ref: () => agency_model_1.Agency }),
    __metadata("design:type", Object)
], DriverAgency.prototype, "agency", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ enum: [], default: '' }) // TODO:
    ,
    __metadata("design:type", String)
], DriverAgency.prototype, "employmentType", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], DriverAgency.prototype, "createdAt", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], DriverAgency.prototype, "updatedAt", void 0);
exports.DriverAgency = DriverAgency = __decorate([
    (0, type_graphql_1.ObjectType)()
], DriverAgency);
const DriverAgencyModel = (0, typegoose_1.getModelForClass)(DriverAgency);
exports.default = DriverAgencyModel;
//# sourceMappingURL=driverAgency.model.js.map