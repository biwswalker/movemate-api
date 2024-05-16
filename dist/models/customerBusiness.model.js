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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessCustomer = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
let BusinessCustomer = class BusinessCustomer {
    static findByUserNumber(userNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return BusinessCustomerModel.findOne({ userNumber });
        });
    }
};
exports.BusinessCustomer = BusinessCustomer;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ enum: ["Co", "Part", "Pub", "other"], required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessTitle", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessName", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessBranch", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessTypeOther", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(13),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "taxNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "subDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "postcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "contactNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEmail)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "businessEmail", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ enum: ["cash", "credit"], required: true }),
    __metadata("design:type", String)
], BusinessCustomer.prototype, "paymentMethod", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Date)
], BusinessCustomer.prototype, "acceptedEDocumentDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Number)
], BusinessCustomer.prototype, "acceptedPoliciesVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Date)
], BusinessCustomer.prototype, "acceptedPoliciesDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Number)
], BusinessCustomer.prototype, "acceptedTermConditionVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Date)
], BusinessCustomer.prototype, "acceptedTermConditionDate", void 0);
exports.BusinessCustomer = BusinessCustomer = __decorate([
    (0, type_graphql_1.ObjectType)()
], BusinessCustomer);
const BusinessCustomerModel = (0, typegoose_1.getModelForClass)(BusinessCustomer);
exports.default = BusinessCustomerModel;
//# sourceMappingURL=customerBusiness.model.js.map