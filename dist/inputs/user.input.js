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
exports.UpdateBusinessDetailInput = exports.UpdateUserInput = exports.RegisterInput = void 0;
const type_graphql_1 = require("type-graphql");
const customer_input_1 = require("./customer.input");
let RegisterInput = class RegisterInput {
};
exports.RegisterInput = RegisterInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "userType", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "password", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RegisterInput.prototype, "remark", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int),
    __metadata("design:type", Number)
], RegisterInput.prototype, "acceptPolicyVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "acceptPolicyTime", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => customer_input_1.RegisterIndividualInput, { nullable: true }),
    __metadata("design:type", customer_input_1.RegisterIndividualInput)
], RegisterInput.prototype, "individualDetail", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => customer_input_1.RegisterBusinessInput, { nullable: true }),
    __metadata("design:type", customer_input_1.RegisterBusinessInput)
], RegisterInput.prototype, "businessDetail", void 0);
exports.RegisterInput = RegisterInput = __decorate([
    (0, type_graphql_1.InputType)()
], RegisterInput);
let UpdateUserInput = class UpdateUserInput {
};
exports.UpdateUserInput = UpdateUserInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "id", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "userType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "username", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "password", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "registration", void 0);
__decorate([
    (0, type_graphql_1.Field)(type => type_graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], UpdateUserInput.prototype, "acceptPolicyVersion", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "acceptPolicyTime", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "email", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "phoneNumbers", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "title", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "firstname", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "lastname", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "identityId", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "branch", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "country", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "subDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "postcode", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "corporateTitles", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "corporateName", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "taxId", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "corporateBranch", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "businessType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "businessTypeOther", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "documentBusinessRegisterCertification", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "documentValueAddedTaxRegistrationCertification", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateUserInput.prototype, "documentCopyAuthorizedSignatoryIDCard", void 0);
exports.UpdateUserInput = UpdateUserInput = __decorate([
    (0, type_graphql_1.InputType)()
], UpdateUserInput);
let UpdateBusinessDetailInput = class UpdateBusinessDetailInput {
};
exports.UpdateBusinessDetailInput = UpdateBusinessDetailInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "transportSupervisorPhoneNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "transportSupervisorEmail", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingPhoneNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingEmail", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingAddress", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingCountry", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingProvince", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingSubDiatrict", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "accountingPostcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], UpdateBusinessDetailInput.prototype, "creditTerm", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "creditLimit", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "creditAmount", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "billedType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "dateOfBilled", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "paymentDuedateType", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], UpdateBusinessDetailInput.prototype, "dateOfPaymentDuedate", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], UpdateBusinessDetailInput.prototype, "isAcceptEDocuments", void 0);
exports.UpdateBusinessDetailInput = UpdateBusinessDetailInput = __decorate([
    (0, type_graphql_1.InputType)()
], UpdateBusinessDetailInput);
//# sourceMappingURL=user.input.js.map