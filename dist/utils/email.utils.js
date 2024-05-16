"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.email_sender = void 0;
const nodemailer_1 = require("nodemailer");
const nodemailer_express_handlebars_1 = __importDefault(require("nodemailer-express-handlebars"));
const google_config_1 = require("@configs/google.config");
const path_1 = require("path");
const email_sender = () => {
    const transporter = (0, nodemailer_1.createTransport)({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            user: process.env.GOOGLE_MAIL,
            clientId: process.env.GOOGLE_SERVICE_ID,
            clientSecret: process.env.GOOGLE_SERVICE_SECRET,
            refreshToken: process.env.GOOGLE_SERVICE_REFRESH_TOKEN,
            accessToken: (0, google_config_1.getGoogleOAuth2AccessToken)(),
        }
    });
    transporter.use('compile', (0, nodemailer_express_handlebars_1.default)({
        viewEngine: {
            extname: '.hbs',
            layoutsDir: (0, path_1.join)(__dirname, '..', 'templates'),
            defaultLayout: false
        },
        viewPath: (0, path_1.join)(__dirname, '..', 'templates')
    }));
    return transporter;
};
exports.email_sender = email_sender;
//# sourceMappingURL=email.utils.js.map