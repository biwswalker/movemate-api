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
exports.Driver = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const bcrypt_1 = __importDefault(require("bcrypt"));
const vehicle_model_1 = require("./vehicle.model");
const driverAgency_model_1 = require("./driverAgency.model");
const class_validator_1 = require("class-validator");
var EDriverStatus;
(function (EDriverStatus) {
    EDriverStatus["ACTIVE"] = "active";
    EDriverStatus["BANNED"] = "banned";
})(EDriverStatus || (EDriverStatus = {}));
var EUserStatus;
(function (EUserStatus) {
    EUserStatus["ACTIVE"] = "active";
    EUserStatus["INACTIVE"] = "inactive";
    EUserStatus["WORKING"] = "working";
})(EUserStatus || (EUserStatus = {}));
let Driver = class Driver {
    validatePassword(password) {
        return __awaiter(this, void 0, void 0, function* () {
            return bcrypt_1.default.compare(password, this.password);
        });
    }
    static findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            return DriverModel.findOne({ username });
        });
    }
};
exports.Driver = Driver;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], Driver.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Driver.prototype, "username", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "password", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "email", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "driver_number", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "name", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => vehicle_model_1.Vehicle),
    (0, typegoose_1.prop)({ ref: () => vehicle_model_1.Vehicle }),
    __metadata("design:type", Object)
], Driver.prototype, "vehicle", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [String]),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Array)
], Driver.prototype, "phone_numbers", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], Driver.prototype, "line_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EDriverStatus),
    (0, typegoose_1.prop)({ enum: EDriverStatus, default: EDriverStatus.ACTIVE }),
    __metadata("design:type", String)
], Driver.prototype, "status", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ enum: EUserStatus, default: EUserStatus.ACTIVE }),
    __metadata("design:type", String)
], Driver.prototype, "working_status", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], Driver.prototype, "driving_licence", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "driving_licence_expire", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], Driver.prototype, "criminal_history", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [driverAgency_model_1.DriverAgency]),
    (0, typegoose_1.prop)({ ref: () => driverAgency_model_1.DriverAgency }),
    __metadata("design:type", Object)
], Driver.prototype, "agencies", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "identity_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "country", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "sub_district", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Driver.prototype, "postcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Driver.prototype, "created_at", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Driver.prototype, "updated_at", void 0);
exports.Driver = Driver = __decorate([
    (0, type_graphql_1.ObjectType)()
], Driver);
const DriverModel = (0, typegoose_1.getModelForClass)(Driver);
exports.default = DriverModel;
//# sourceMappingURL=driver.model.js.map