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
exports.Couter = void 0;
const typegoose_1 = require("@typegoose/typegoose");
class Couter {
    static getNextCouter(type) {
        return __awaiter(this, void 0, void 0, function* () {
            const query_option = { upsert: true, new: true };
            if (type === 'individual') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { customerCounter: 1 } }, query_option);
                return counter.customerCounter;
            }
            else if (type === 'business') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { businessCounter: 1 } }, query_option);
                return counter.businessCounter;
            }
            else if (type === 'driver') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { driverCounter: 1 } }, query_option);
                return counter.driverCounter;
            }
            else if (type === 'admin') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { adminCounter: 1 } }, query_option);
                return counter.adminCounter;
            }
            else if (type === 'tracking') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { trackingCounter: 1 } }, query_option);
                return counter.trackingCounter;
            }
            else if (type === 'upload') {
                const counter = yield CouterModel.findOneAndUpdate({}, { $inc: { upload: 1 } }, query_option);
                return counter.upload;
            }
            return 0;
        });
    }
}
exports.Couter = Couter;
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "customerCounter", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "businessCounter", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "driverCounter", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "adminCounter", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "trackingCounter", void 0);
__decorate([
    (0, typegoose_1.prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Couter.prototype, "upload", void 0);
const CouterModel = (0, typegoose_1.getModelForClass)(Couter);
exports.default = CouterModel;
//# sourceMappingURL=counter.model.js.map