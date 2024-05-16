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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleOAuth2AccessToken = void 0;
const googleapis_1 = require("googleapis");
let oAuth2Client = null;
function initialGoogleOAuth() {
    oAuth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_SERVICE_ID, process.env.GOOGLE_SERVICE_SECRET);
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_SERVICE_REFRESH_TOKEN });
}
exports.default = initialGoogleOAuth;
function getGoogleOAuth2AccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        if (oAuth2Client) {
            const accessToken = oAuth2Client.getAccessToken();
            return accessToken;
        }
        return '';
    });
}
exports.getGoogleOAuth2AccessToken = getGoogleOAuth2AccessToken;
//# sourceMappingURL=google.config.js.map