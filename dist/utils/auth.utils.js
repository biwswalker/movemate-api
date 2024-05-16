"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function generateAccessToken(user_id) {
    const SECRET_KEY = process.env.JWT_SECRET;
    const token = jsonwebtoken_1.default.sign({ user_id }, SECRET_KEY, { expiresIn: '1d' });
    return token;
}
exports.generateAccessToken = generateAccessToken;
function verifyAccessToken(token) {
    const SECRET_KEY = process.env.JWT_SECRET;
    const decoded = jsonwebtoken_1.default.verify(token, SECRET_KEY);
    return decoded;
}
exports.verifyAccessToken = verifyAccessToken;
//# sourceMappingURL=auth.utils.js.map