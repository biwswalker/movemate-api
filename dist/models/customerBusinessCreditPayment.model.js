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
exports.BusinessCustomerCreditPayment = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
const file_model_1 = require("./file.model");
let BusinessCustomerCreditPayment = class BusinessCustomerCreditPayment {
};
exports.BusinessCustomerCreditPayment = BusinessCustomerCreditPayment;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)({ default: false }),
    __metadata("design:type", Boolean)
], BusinessCustomerCreditPayment.prototype, "isSameAddress", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialFirstname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialLastname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialContactNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [String]),
    (0, typegoose_1.prop)({ required: true, allowMixed: typegoose_1.Severity.ALLOW }),
    __metadata("design:type", Array)
], BusinessCustomerCreditPayment.prototype, "financialContactEmails", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialAddress", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialPostcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialProvince", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], BusinessCustomerCreditPayment.prototype, "financialSubDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], BusinessCustomerCreditPayment.prototype, "billedDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], BusinessCustomerCreditPayment.prototype, "billedRound", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Date)
], BusinessCustomerCreditPayment.prototype, "acceptedFirstCredit_termDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => file_model_1.File),
    (0, typegoose_1.prop)({ ref: () => file_model_1.File }),
    __metadata("design:type", Object)
], BusinessCustomerCreditPayment.prototype, "businessRegistrationCertificateFile", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => file_model_1.File),
    (0, typegoose_1.prop)({ ref: () => file_model_1.File }),
    __metadata("design:type", Object)
], BusinessCustomerCreditPayment.prototype, "copyIDAuthorizedSignatoryFile", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => file_model_1.File, { nullable: true }),
    (0, typegoose_1.prop)({ ref: () => file_model_1.File }),
    __metadata("design:type", Object)
], BusinessCustomerCreditPayment.prototype, "certificateValueAddedTaxRefistrationFile", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.Float),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], BusinessCustomerCreditPayment.prototype, "creditLimit", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.Float),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], BusinessCustomerCreditPayment.prototype, "creditUsage", void 0);
exports.BusinessCustomerCreditPayment = BusinessCustomerCreditPayment = __decorate([
    (0, type_graphql_1.ObjectType)()
], BusinessCustomerCreditPayment);
const BusinessCustomerCreditPaymentModel = (0, typegoose_1.getModelForClass)(BusinessCustomerCreditPayment);
exports.default = BusinessCustomerCreditPaymentModel;
//# sourceMappingURL=customerBusinessCreditPayment.model.js.map