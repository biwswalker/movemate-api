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
exports.Payment = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const class_validator_1 = require("class-validator");
var EPaymentStatus;
(function (EPaymentStatus) {
    EPaymentStatus["WAITING_FOR_WORK_COMPLETE"] = "WAITING_FOR_WORK_COMPLETE";
    EPaymentStatus["WAITING_FOR_PAYMENT"] = "WAITING_FOR_PAYMENT";
    EPaymentStatus["CANCELLED"] = "CANCELLED";
    EPaymentStatus["PAID"] = "PAID";
})(EPaymentStatus || (EPaymentStatus = {}));
let Payment = class Payment {
};
exports.Payment = Payment;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], Payment.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], Payment.prototype, "amount", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EPaymentStatus),
    (0, typegoose_1.prop)({ required: true, enum: EPaymentStatus, default: EPaymentStatus.WAITING_FOR_WORK_COMPLETE }),
    __metadata("design:type", String)
], Payment.prototype, "status", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Payment.prototype, "created_at", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Payment.prototype, "updated_at", void 0);
exports.Payment = Payment = __decorate([
    (0, type_graphql_1.ObjectType)()
], Payment);
const PaymentModel = (0, typegoose_1.getModelForClass)(Payment);
exports.default = PaymentModel;
//# sourceMappingURL=payment.model.js.map