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
exports.ShipmentPricingInput = exports.ShipmentPricing = void 0;
const typegoose_1 = require("@typegoose/typegoose");
const lodash_1 = require("lodash");
const type_graphql_1 = require("type-graphql");
let ShipmentPricing = class ShipmentPricing {
    getTotal() {
        return (0, lodash_1.sum)([
            this.shipping_price,
            this.handling_goods_driver_price,
            this.handling_goods_labor_price,
            this.pod_service_price_price,
            this.hold_pickup_price_price,
            this.service_vat_price,
            this.transport_wht_price,
            this.service_wht_price,
            -this.discount_price
        ]);
    }
    getCostTotal() {
        return (0, lodash_1.sum)([
            this.shipping_cost,
            this.handling_goods_driver_cost,
            this.handling_goods_labor_cost,
            this.pod_service_price_cost,
            this.hold_pickup_price_cost,
            this.service_vat_cost,
            this.transport_wht_cost,
            this.service_wht_cost,
        ]);
    }
};
exports.ShipmentPricing = ShipmentPricing;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], ShipmentPricing.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "discount_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "shipping_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "shipping_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "handling_goods_driver_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "handling_goods_driver_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "handling_goods_labor_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "handling_goods_labor_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "pod_service_price_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "pod_service_price_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "hold_pickup_price_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "hold_pickup_price_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "service_vat_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "service_vat_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "transport_wht_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "transport_wht_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "service_wht_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Number)
], ShipmentPricing.prototype, "service_wht_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], ShipmentPricing.prototype, "created_at", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], ShipmentPricing.prototype, "updated_at", void 0);
exports.ShipmentPricing = ShipmentPricing = __decorate([
    (0, type_graphql_1.ObjectType)()
], ShipmentPricing);
const ShipmentPricingModel = (0, typegoose_1.getModelForClass)(ShipmentPricing);
exports.default = ShipmentPricingModel;
let ShipmentPricingInput = class ShipmentPricingInput {
};
exports.ShipmentPricingInput = ShipmentPricingInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "shipping_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "shipping_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "handling_goods_driver_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "handling_goods_driver_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "handling_goods_labor_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "handling_goods_labor_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "pod_service_price_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "pod_service_price_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "hold_pickup_price_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "hold_pickup_price_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "service_vat_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "service_vat_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "transport_wht_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "transport_wht_cost", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "service_wht_price", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], ShipmentPricingInput.prototype, "service_wht_cost", void 0);
exports.ShipmentPricingInput = ShipmentPricingInput = __decorate([
    (0, type_graphql_1.InputType)()
], ShipmentPricingInput);
//# sourceMappingURL=shipmentPricing.model.js.map