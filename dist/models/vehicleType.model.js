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
exports.VehicleType = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
const vehicleCost_model_1 = require("./vehicleCost.model");
var EVehicleType;
(function (EVehicleType) {
    EVehicleType["FOUR_WHEELER"] = "FOUR_WHEELER";
    EVehicleType["SIX_WHEELER"] = "SIX_WHEELER";
    EVehicleType["TEN_WHEELER"] = "TEN_WHEELER";
    EVehicleType["TRAILER"] = "TRAILER";
})(EVehicleType || (EVehicleType = {}));
let VehicleType = class VehicleType {
};
exports.VehicleType = VehicleType;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], VehicleType.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => vehicleCost_model_1.VehicleCost, { nullable: true }),
    (0, typegoose_1.prop)({ allowMixed: typegoose_1.Severity.ALLOW }),
    __metadata("design:type", Object)
], VehicleType.prototype, "vehicle_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ enum: EVehicleType, required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "vehicle_type", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.Length)(0, 100),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "description_1", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.Length)(0, 100),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "description_2", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.Length)(0, 100),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "description_3", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "full_description", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], VehicleType.prototype, "thumbnail_image", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], VehicleType.prototype, "created_at", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], VehicleType.prototype, "updated_at", void 0);
exports.VehicleType = VehicleType = __decorate([
    (0, type_graphql_1.ObjectType)()
], VehicleType);
const VehicleTypeModel = (0, typegoose_1.getModelForClass)(VehicleType);
exports.default = VehicleTypeModel;
//# sourceMappingURL=vehicleType.model.js.map