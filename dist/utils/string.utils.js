"use strict";
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
exports.generateId = exports.generateRandomNumberPattern = void 0;
const counter_model_1 = __importDefault(require("@models/counter.model"));
// import { format } from "date-fns";
// import { toZonedTime } from "date-fns-tz";
const lodash_1 = require("lodash");
function generateRandomNumberPattern(pattern = 'MM##########') {
    let trackingNumber = '';
    for (let i = 0; i < pattern.length; i++) {
        const currentChar = pattern.charAt(i);
        if (currentChar === '#') {
            trackingNumber += Math.floor(Math.random() * 10).toString();
        }
        else {
            trackingNumber += currentChar;
        }
    }
    return trackingNumber;
}
exports.generateRandomNumberPattern = generateRandomNumberPattern;
function generateId(prefix, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const counter = yield counter_model_1.default.getNextCouter(type);
        // const nowUTC = utcToZonedTime(new Date(), 'UTC')
        // const datetime_id = format(nowUTC, 'yyMM')
        const running_id = (0, lodash_1.padStart)(`${counter}`, 4, '0');
        return `${prefix}${running_id}`;
    });
}
exports.generateId = generateId;
//# sourceMappingURL=string.utils.js.map