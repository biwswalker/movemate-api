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
exports.User = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_js_1 = __importDefault(require("crypto-js"));
var EUserType;
(function (EUserType) {
    EUserType["INDIVIDUAL"] = "individual";
    EUserType["BUSINESS"] = "business";
})(EUserType || (EUserType = {}));
var EUserStatus;
(function (EUserStatus) {
    EUserStatus["ACTIVE"] = "active";
    EUserStatus["BANNED"] = "banned";
})(EUserStatus || (EUserStatus = {}));
var EUserValidationStatus;
(function (EUserValidationStatus) {
    EUserValidationStatus["PENDING"] = "pending";
    EUserValidationStatus["APPROVE"] = "approve";
    EUserValidationStatus["DENIED"] = "denied";
})(EUserValidationStatus || (EUserValidationStatus = {}));
var ERegistration;
(function (ERegistration) {
    ERegistration["WEB"] = "web";
    ERegistration["APP"] = "app";
})(ERegistration || (ERegistration = {}));
let User = class User {
    validatePassword(password) {
        return __awaiter(this, void 0, void 0, function* () {
            const password_decryption = crypto_js_1.default.AES.decrypt(password, process.env.MOVEMATE_SHARED_KEY).toString();
            return bcrypt_1.default.compare(password_decryption, this.password);
        });
    }
    static findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            return UserModel.findOne({ username });
        });
    }
};
exports.User = User;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], User.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EUserType),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ enum: EUserType, default: EUserType.INDIVIDUAL, required: true }),
    __metadata("design:type", String)
], User.prototype, "userType", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "username", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], User.prototype, "remark", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EUserStatus),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, enum: EUserStatus, default: EUserStatus.ACTIVE }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EUserValidationStatus),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({
        required: true,
        enum: EUserValidationStatus,
        default: EUserValidationStatus.PENDING,
    }),
    __metadata("design:type", String)
], User.prototype, "validationStatus", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(ERegistration),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, enum: ERegistration, default: ERegistration.WEB }),
    __metadata("design:type", String)
], User.prototype, "registration", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], User.prototype, "lastestOTP", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], User.prototype, "lastestOTPRef", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Boolean)
], User.prototype, "isVerifiedEmail", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Boolean)
], User.prototype, "isVerifiedPhoneNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)((type) => type_graphql_1.Int),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], User.prototype, "acceptPolicyVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], User.prototype, "acceptPolicyTime", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
exports.User = User = __decorate([
    (0, type_graphql_1.ObjectType)()
], User);
const UserModel = (0, typegoose_1.getModelForClass)(User);
exports.default = UserModel;
//# sourceMappingURL=user.model.js.map