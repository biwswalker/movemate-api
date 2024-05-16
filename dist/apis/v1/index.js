"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const email_api_1 = __importDefault(require("./email.api"));
const ping_api_1 = __importDefault(require("./ping.api"));
const api_v1 = (0, express_1.Router)();
api_v1.use('/email', email_api_1.default);
api_v1.use('/ping', ping_api_1.default);
exports.default = api_v1;
//# sourceMappingURL=index.js.map