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
exports.RegisterBusinessInput = exports.CreditPaymentInput = exports.FileInput = exports.CashPaymentInput = exports.RegisterIndividualInput = void 0;
const class_validator_1 = require("class-validator");
const type_graphql_1 = require("type-graphql");
let RegisterIndividualInput = class RegisterIndividualInput {
};
exports.RegisterIndividualInput = RegisterIndividualInput;
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "email", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "title", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "firstname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "lastname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "phoneNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "taxId", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "subDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterIndividualInput.prototype, "postcode", void 0);
exports.RegisterIndividualInput = RegisterIndividualInput = __decorate([
    (0, type_graphql_1.InputType)()
], RegisterIndividualInput);
let CashPaymentInput = class CashPaymentInput {
};
exports.CashPaymentInput = CashPaymentInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], CashPaymentInput.prototype, "acceptedEReceiptDate", void 0);
exports.CashPaymentInput = CashPaymentInput = __decorate([
    (0, type_graphql_1.InputType)()
], CashPaymentInput);
let FileInput = class FileInput {
};
exports.FileInput = FileInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], FileInput.prototype, "fileId", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], FileInput.prototype, "filename", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], FileInput.prototype, "mimetype", void 0);
exports.FileInput = FileInput = __decorate([
    (0, type_graphql_1.InputType)()
], FileInput);
let CreditPaymentInput = class CreditPaymentInput {
};
exports.CreditPaymentInput = CreditPaymentInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], CreditPaymentInput.prototype, "isSameAddress", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialFirstname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialLastname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialContactNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [String]),
    __metadata("design:type", Array)
], CreditPaymentInput.prototype, "financialContactEmails", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialAddress", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialPostcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialProvince", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], CreditPaymentInput.prototype, "financialSubDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], CreditPaymentInput.prototype, "acceptedFirstCreditTermDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => FileInput),
    __metadata("design:type", FileInput)
], CreditPaymentInput.prototype, "businessRegistrationCertificateFile", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => FileInput),
    __metadata("design:type", FileInput)
], CreditPaymentInput.prototype, "copyIDAuthorizedSignatoryFile", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => FileInput, { nullable: true }),
    __metadata("design:type", FileInput)
], CreditPaymentInput.prototype, "certificateValueAddedTaxRegistrationFile", void 0);
exports.CreditPaymentInput = CreditPaymentInput = __decorate([
    (0, type_graphql_1.InputType)()
], CreditPaymentInput);
let RegisterBusinessInput = class RegisterBusinessInput {
};
exports.RegisterBusinessInput = RegisterBusinessInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessTitle", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessName", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessBranch", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessTypeOther", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "taxNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "subDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "postcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "contactNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "businessEmail", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterBusinessInput.prototype, "paymentMethod", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], RegisterBusinessInput.prototype, "acceptedEDocumentDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    __metadata("design:type", Number)
], RegisterBusinessInput.prototype, "acceptedPoliciesVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], RegisterBusinessInput.prototype, "acceptedPoliciesDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    __metadata("design:type", Number)
], RegisterBusinessInput.prototype, "acceptedTermConditionVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], RegisterBusinessInput.prototype, "acceptedTermConditionDate", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => CashPaymentInput, { nullable: true }),
    __metadata("design:type", CashPaymentInput)
], RegisterBusinessInput.prototype, "paymentCashDetail", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => CreditPaymentInput, { nullable: true }),
    __metadata("design:type", CreditPaymentInput)
], RegisterBusinessInput.prototype, "paymentCreditDetail", void 0);
exports.RegisterBusinessInput = RegisterBusinessInput = __decorate([
    (0, type_graphql_1.InputType)()
], RegisterBusinessInput);
//# sourceMappingURL=customer.input.js.map