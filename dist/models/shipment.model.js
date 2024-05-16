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
exports.ShipmentInput = exports.RouteInput = exports.DestinationInput = exports.Shipment = exports.Route = void 0;
const type_graphql_1 = require("type-graphql");
const typegoose_1 = require("@typegoose/typegoose");
const user_model_1 = require("./user.model");
const payment_model_1 = require("./payment.model");
const class_validator_1 = require("class-validator");
const privilege_model_1 = require("./privilege.model");
const shipmentPricing_model_1 = require("./shipmentPricing.model");
const driver_model_1 = require("./driver.model");
const vehicleType_model_1 = require("./vehicleType.model");
var EShipingStatus;
(function (EShipingStatus) {
    EShipingStatus["PENDING"] = "PENDING";
    EShipingStatus["ACCEPTED"] = "ACCEPTED";
    EShipingStatus["DELIVERED"] = "DELIVERED";
    EShipingStatus["CANCELLED"] = "CANCELLED";
})(EShipingStatus || (EShipingStatus = {}));
var EIssueType;
(function (EIssueType) {
    EIssueType["DELAY"] = "DELAY";
    EIssueType["DAMAGE"] = "DAMAGE";
    EIssueType["MISSING"] = "MISSING";
    EIssueType["OTHER"] = "OTHER";
})(EIssueType || (EIssueType = {}));
let Route = class Route {
};
exports.Route = Route;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], Route.prototype, "name", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], Route.prototype, "start_coordinate", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], Route.prototype, "destination_coordinate", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Number)
], Route.prototype, "distance", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], Route.prototype, "contact_name", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], Route.prototype, "contact_address", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], Route.prototype, "contact_number", void 0);
exports.Route = Route = __decorate([
    (0, type_graphql_1.ObjectType)(),
    (0, typegoose_1.modelOptions)({ options: { allowMixed: typegoose_1.Severity.ALLOW } })
], Route);
let Shipment = class Shipment {
};
exports.Shipment = Shipment;
__decorate([
    (0, type_graphql_1.Field)(() => type_graphql_1.ID),
    __metadata("design:type", String)
], Shipment.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Date)
], Shipment.prototype, "book_date", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Date)
], Shipment.prototype, "accepted_driver_date", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Boolean)
], Shipment.prototype, "returned_route", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", String)
], Shipment.prototype, "tracking_number", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, class_validator_1.IsEnum)(EShipingStatus),
    (0, typegoose_1.prop)({ required: true, enum: EShipingStatus }),
    __metadata("design:type", String)
], Shipment.prototype, "status", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsEnum)(EIssueType),
    (0, typegoose_1.prop)({ enum: EIssueType }),
    __metadata("design:type", String)
], Shipment.prototype, "issue_type", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", String)
], Shipment.prototype, "issue_reason", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => user_model_1.User),
    (0, typegoose_1.prop)({ ref: () => user_model_1.User, required: true }),
    __metadata("design:type", Object)
], Shipment.prototype, "customer", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => vehicleType_model_1.VehicleType),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Object)
], Shipment.prototype, "vehicle_type", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => driver_model_1.Driver, { nullable: true }),
    (0, typegoose_1.prop)(),
    __metadata("design:type", Object)
], Shipment.prototype, "driver", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Route)
], Shipment.prototype, "origin", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [Route]),
    (0, typegoose_1.prop)({ required: true, allowMixed: typegoose_1.Severity.ALLOW }),
    __metadata("design:type", Array)
], Shipment.prototype, "destinations", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => shipmentPricing_model_1.ShipmentPricing),
    (0, typegoose_1.prop)({ ref: () => shipmentPricing_model_1.ShipmentPricing, required: true }),
    __metadata("design:type", Object)
], Shipment.prototype, "shiping_pricing", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Boolean)
], Shipment.prototype, "handling_goods_driver", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Boolean)
], Shipment.prototype, "handling_goods_labor", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Boolean)
], Shipment.prototype, "pod_service", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ required: true }),
    __metadata("design:type", Boolean)
], Shipment.prototype, "hold_pickup", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => payment_model_1.Payment),
    (0, typegoose_1.prop)({ ref: () => payment_model_1.Payment, required: true }),
    __metadata("design:type", Object)
], Shipment.prototype, "payment", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => privilege_model_1.Privilege, { nullable: true }),
    (0, typegoose_1.prop)({ ref: () => privilege_model_1.Privilege }),
    __metadata("design:type", Object)
], Shipment.prototype, "privilege", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Shipment.prototype, "created_at", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    (0, typegoose_1.prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Shipment.prototype, "updated_at", void 0);
exports.Shipment = Shipment = __decorate([
    (0, type_graphql_1.ObjectType)()
], Shipment);
const ShipmentModel = (0, typegoose_1.getModelForClass)(Shipment);
exports.default = ShipmentModel;
let DestinationInput = class DestinationInput {
};
exports.DestinationInput = DestinationInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], DestinationInput.prototype, "route_name", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], DestinationInput.prototype, "point", void 0);
exports.DestinationInput = DestinationInput = __decorate([
    (0, type_graphql_1.InputType)()
], DestinationInput);
let RouteInput = class RouteInput {
};
exports.RouteInput = RouteInput;
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RouteInput.prototype, "name", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], RouteInput.prototype, "start_coordinate", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RouteInput.prototype, "destination_coordinate", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Number)
], RouteInput.prototype, "distance", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RouteInput.prototype, "contact_name", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RouteInput.prototype, "contact_address", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], RouteInput.prototype, "contact_number", void 0);
exports.RouteInput = RouteInput = __decorate([
    (0, type_graphql_1.InputType)()
], RouteInput);
let ShipmentInput = class ShipmentInput {
};
exports.ShipmentInput = ShipmentInput;
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], ShipmentInput.prototype, "_id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], ShipmentInput.prototype, "book_date", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], ShipmentInput.prototype, "returned_route", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], ShipmentInput.prototype, "customer", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], ShipmentInput.prototype, "vehicle_type", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", RouteInput)
], ShipmentInput.prototype, "origin", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => [RouteInput]),
    __metadata("design:type", Array)
], ShipmentInput.prototype, "destinations", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], ShipmentInput.prototype, "shiping_pricing", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], ShipmentInput.prototype, "handling_goods_driver", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], ShipmentInput.prototype, "handling_goods_labor", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], ShipmentInput.prototype, "pod_service", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Boolean)
], ShipmentInput.prototype, "hold_pickup", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], ShipmentInput.prototype, "payment", void 0);
__decorate([
    (0, type_graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], ShipmentInput.prototype, "privilege", void 0);
exports.ShipmentInput = ShipmentInput = __decorate([
    (0, type_graphql_1.InputType)()
], ShipmentInput);
//# sourceMappingURL=shipment.model.js.map