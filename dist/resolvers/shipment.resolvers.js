"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
const auth_guards_1 = require("../guards/auth.guards");
const payment_model_1 = __importStar(require("../models/payment.model"));
const privilege_model_1 = __importDefault(require("../models/privilege.model"));
const shipment_model_1 = __importStar(require("../models/shipment.model"));
const shipmentPricing_model_1 = __importDefault(require("../models/shipmentPricing.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const string_utils_1 = require("../utils/string.utils");
const lodash_1 = require("lodash");
const type_graphql_1 = require("type-graphql");
let ShipmentResolver = class ShipmentResolver {
    shipment(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shipment = yield shipment_model_1.default.findById(id);
                return shipment;
            }
            catch (error) {
                console.log(error);
                throw new Error('Failed to get shipment');
            }
        });
    }
    shipments() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shipment = yield shipment_model_1.default.find();
                return shipment;
            }
            catch (error) {
                console.log(error);
                throw new Error('Failed to get shipments');
            }
        });
    }
    customerShipments(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shipments = yield shipment_model_1.default.find({ customer: customerId });
                return shipments;
            }
            catch (error) {
                console.error('Error fetching shipments:', error);
                return [];
            }
        });
    }
    customer(shipment) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customerId = (0, lodash_1.get)(shipment, '_doc.customer', '') || (0, lodash_1.get)(shipment, 'customer', '');
                const customer = yield user_model_1.default.findById(customerId);
                if (!customer) {
                    return null;
                }
                return customer;
            }
            catch (error) {
                console.error('Error get customer:', error);
                return null;
            }
        });
    }
    driver(shipment) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const driverId = (0, lodash_1.get)(shipment, '_doc.driver', '') || (0, lodash_1.get)(shipment, 'driver', '');
                const driver = yield user_model_1.default.findById(driverId);
                if (!driver) {
                    return null;
                }
                return driver;
            }
            catch (error) {
                console.error('Error get driver:', error);
                return null;
            }
        });
    }
    payment(shipment) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentId = (0, lodash_1.get)(shipment, '_doc.payment', '') || (0, lodash_1.get)(shipment, 'payment', '');
                const payment = yield payment_model_1.default.findById(paymentId);
                if (!payment) {
                    return null;
                }
                return payment;
            }
            catch (error) {
                console.error('Error get payment:', error);
                return null;
            }
        });
    }
    createShipment(data, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user_id = ctx.req.user_id;
                // TODO: Create get pricing config 
                // TODO: Calculate distance and pricing here
                const amount = '7000';
                // data.privilege
                let discount = 0;
                if (data.privilege) {
                    const privilege = yield privilege_model_1.default.findById(data.privilege);
                    if (privilege.discount_unit === 'CURRENCY') {
                        discount = privilege.discount_number;
                    }
                    else if (privilege.discount_unit === 'PERCENTAGE') {
                        // before this must calculate route sub total first
                        // privilege.discount_number
                    }
                }
                // TODO
                const shipmentPricing = new shipmentPricing_model_1.default({ amount });
                yield shipmentPricing.save();
                // TODO
                const payment = new payment_model_1.default({ amount });
                yield payment.save();
                const tracking_number = (0, string_utils_1.generateId)('TT', 'tracking');
                const shipment = new shipment_model_1.default(Object.assign(Object.assign({ customer: user_id }, data), { tracking_number, status: 'PENDING', shiping_pricing: shipmentPricing, payment }));
                yield shipment.save();
                return shipment;
            }
            catch (error) {
                console.log(error);
                throw new Error('Failed to create shipment');
            }
        });
    }
};
__decorate([
    (0, type_graphql_1.Query)(() => shipment_model_1.Shipment),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Arg)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "shipment", null);
__decorate([
    (0, type_graphql_1.Query)(() => [shipment_model_1.Shipment]),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "shipments", null);
__decorate([
    (0, type_graphql_1.Query)(() => [shipment_model_1.Shipment]),
    __param(0, (0, type_graphql_1.Arg)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "customerShipments", null);
__decorate([
    (0, type_graphql_1.FieldResolver)(() => user_model_1.User),
    __param(0, (0, type_graphql_1.Root)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [shipment_model_1.Shipment]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "customer", null);
__decorate([
    (0, type_graphql_1.FieldResolver)(() => user_model_1.User),
    __param(0, (0, type_graphql_1.Root)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [shipment_model_1.Shipment]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "driver", null);
__decorate([
    (0, type_graphql_1.FieldResolver)(() => payment_model_1.Payment),
    __param(0, (0, type_graphql_1.Root)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [shipment_model_1.Shipment]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "payment", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => shipment_model_1.Shipment),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Arg)('data')),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [shipment_model_1.ShipmentInput, Object]),
    __metadata("design:returntype", Promise)
], ShipmentResolver.prototype, "createShipment", null);
ShipmentResolver = __decorate([
    (0, type_graphql_1.Resolver)(shipment_model_1.Shipment)
], ShipmentResolver);
exports.default = ShipmentResolver;
//# sourceMappingURL=shipment.resolvers.js.map