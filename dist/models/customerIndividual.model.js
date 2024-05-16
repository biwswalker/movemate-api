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
exports.IndividualCustomer = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
let IndividualCustomer = class IndividualCustomer {
    static findByUserNumber(userNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return IndividualCustomerModel.findOne({ userNumber });
        });
    }
};
exports.IndividualCustomer = IndividualCustomer;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "userNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "email", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "title", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "firstname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "lastname", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "phoneNumber", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(13),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "taxId", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "address", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "province", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "district", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "subDistrict", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsString)(),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "postcode", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({
        default: function ({ firstname, lastname }) {
            return `${firstname} ${lastname}`;
        }
    }),
    __metadata("design:type", String)
], IndividualCustomer.prototype, "fullName", void 0);
exports.IndividualCustomer = IndividualCustomer = __decorate([
    (0, type_graphql_1.ObjectType)()
], IndividualCustomer);
const IndividualCustomerModel = (0, typegoose_1.getModelForClass)(IndividualCustomer);
exports.default = IndividualCustomerModel;
//# sourceMappingURL=customerIndividual.model.js.map