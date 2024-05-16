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
const email_utils_1 = require("../../utils/email.utils");
const express_1 = require("express");
const email_api = (0, express_1.Router)();
email_api.get('/sample', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email_to = req.query.to || 'jennarong.sae@gmail.com';
    const email_transpoter = (0, email_utils_1.email_sender)();
    yield email_transpoter.sendMail({
        from: process.env.GOOGLE_MAIL,
        to: email_to,
        subject: 'Testiing email',
        template: 'simple',
        context: {
            name: 'GGWP',
            message: 'This is GGWP message'
        }
    });
    // const base64_image = await imageToBase64(join(resolve('.'), 'assets', 'email_logo.png'))
    // const image_url = new SafeString(`data:image/png;base64,${base64_image}`)
    // await email_transpoter.sendMail({
    //     from: process.env.GOOGLE_MAIL,
    //     to: email_to,
    //     subject: 'ยืนยันการสมัครสมาชิก Movemate!',
    //     template: 'register_individual',
    //     context: {
    //         fullname: 'เจนณรงค์ แสนแปง',
    //         username: "jennarong.sae@mail.com",
    //         logo: image_url,
    //         activate_link: `https://api.movemateth.com/activate/customer/44444444`,
    //         movemate_line: `https://www.movemateth.com`,
    //     }
    // })
    res.status(200).send('email has sent');
}));
exports.default = email_api;
//# sourceMappingURL=email.api.js.map