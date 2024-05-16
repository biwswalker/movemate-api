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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const type_graphql_1 = require("type-graphql");
const user_model_1 = __importStar(require("../models/user.model"));
const customerIndividual_model_1 = __importDefault(require("../models/customerIndividual.model"));
const customerBusiness_model_1 = __importDefault(require("../models/customerBusiness.model"));
const customerBusinessCashPayment_model_1 = __importDefault(require("../models/customerBusinessCashPayment.model"));
const customerBusinessCreditPayment_model_1 = __importDefault(require("../models/customerBusinessCreditPayment.model"));
const user_input_1 = require("../inputs/user.input");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_guards_1 = require("../guards/auth.guards");
const lodash_1 = require("lodash");
const string_utils_1 = require("../utils/string.utils");
const email_utils_1 = require("../utils/email.utils");
const image_to_base64_1 = __importDefault(require("image-to-base64"));
const path_1 = require("path");
const handlebars_1 = require("handlebars");
const graphql_1 = require("graphql");
const file_model_1 = __importDefault(require("../models/file.model"));
const user_payloads_1 = require("../payloads/user.payloads");
const customerIndividual_model_2 = __importDefault(require("../models/customerIndividual.model"));
let UserResolver = class UserResolver {
    users() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield user_model_1.default.find();
                return users;
            }
            catch (error) {
                throw new Error("Failed to fetch users");
            }
        });
    }
    user(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.default.findById(id);
                if (!user) {
                    throw new Error("User not found");
                }
                return user;
            }
            catch (error) {
                throw new Error("Failed to fetch user");
            }
        });
    }
    me(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = ctx.req.user_id;
                if (!userId) {
                    throw new type_graphql_1.AuthenticationError("ไม่พบผู้ใช้");
                }
                const user = yield user_model_1.default.findById(userId);
                if (!user) {
                    throw new type_graphql_1.AuthenticationError("ไม่พบผู้ใช้");
                }
                if (user.userType === 'individual') {
                    const individualDetail = yield customerIndividual_model_2.default.findByUserNumber(user.userNumber);
                    return {
                        user,
                        individualDetail
                    };
                }
                else if (user.userType === 'business') {
                    const businessDetail = yield customerBusiness_model_1.default.findByUserNumber(user.userNumber);
                    return {
                        user,
                        businessDetail
                    };
                }
                return {
                    user
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    register(data, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userType, password, remark, acceptPolicyTime, acceptPolicyVersion, individualDetail, businessDetail } = data;
            try {
                // Check if the user already exists
                const platform = ctx.req.headers["platform"];
                if ((0, lodash_1.isEmpty)(platform)) {
                    throw new Error("Bad Request: Platform is require");
                }
                // Prepare email sender
                const emailTranspoter = (0, email_utils_1.email_sender)();
                // Conver image path to base64 image
                const base64Image = yield (0, image_to_base64_1.default)((0, path_1.join)((0, path_1.resolve)('.'), 'assets', 'email_logo.png'));
                const imageUrl = new handlebars_1.SafeString(`data:image/png;base64,${base64Image}`);
                // Exist email
                const userEmail = (0, lodash_1.isEqual)(userType, 'individual') ? (0, lodash_1.get)(individualDetail, 'email', '') : (0, lodash_1.isEqual)(userType, 'business') ? (0, lodash_1.get)(businessDetail, 'businessEmail', '') : '';
                const fieldName = userType === 'individual' ? 'email' : 'businessEmail';
                if (userEmail) {
                    const isExistingEmailWithIndividual = yield customerIndividual_model_1.default.findOne({
                        email: userEmail,
                    });
                    if (isExistingEmailWithIndividual) {
                        throw new graphql_1.GraphQLError('ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ', {
                            extensions: {
                                code: 'ERROR_VALIDATION',
                                errors: [{ field: fieldName, message: 'ไม่สามารถใช้อีเมลร่วมกับสมากชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ' }],
                            }
                        });
                    }
                    const isExistingEmailWithBusiness = yield customerBusiness_model_1.default.findOne({
                        businessEmail: userEmail,
                    });
                    if (isExistingEmailWithBusiness) {
                        throw new graphql_1.GraphQLError('อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
                            extensions: {
                                code: 'ERROR_VALIDATION',
                                errors: [{ field: fieldName, message: 'อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ' }],
                            }
                        });
                    }
                }
                else {
                    throw new graphql_1.GraphQLError('ระบุอีเมล', {
                        extensions: {
                            code: 'ERROR_VALIDATION',
                            errors: [{ field: fieldName, message: 'ระบุอีเมล' }],
                        }
                    });
                }
                /**
                 * Individual Customer Register
                 */
                if (userType === "individual" && individualDetail) {
                    const isExistingEmail = yield customerIndividual_model_1.default.findOne({
                        email: individualDetail.email,
                    });
                    if (isExistingEmail) {
                        throw new Error("อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ");
                    }
                    const userNumber = yield (0, string_utils_1.generateId)("MMIN", userType);
                    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
                    const user = new user_model_1.default({
                        userNumber,
                        userType,
                        username: individualDetail.email,
                        password: hashedPassword,
                        remark,
                        registration: platform,
                        isVerifiedEmail: false,
                        isVerifiedPhoneNumber: false,
                        acceptPolicyVersion,
                        acceptPolicyTime,
                    });
                    const individualCustomer = new customerIndividual_model_1.default(Object.assign({ userNumber }, individualDetail));
                    yield user.save();
                    yield individualCustomer.save();
                    // Email sender
                    yield emailTranspoter.sendMail({
                        from: process.env.GOOGLE_MAIL,
                        to: individualDetail.email,
                        subject: 'ยืนยันการสมัครสมาชิก Movemate!',
                        template: 'register_individual',
                        context: {
                            fullname: individualCustomer.fullName,
                            username: individualDetail.email,
                            logo: imageUrl,
                            activateLink: `https://api.movemateth.com/activate/customer/${userNumber}`,
                            movemateLink: `https://www.movemateth.com`,
                        }
                    });
                    return { user, individualDetail: individualCustomer };
                }
                /**
                 * Business Customer Register
                 */
                if (userType === "business" && businessDetail) {
                    if (!businessDetail) {
                        throw new Error("ข้อมูลไม่สมบูรณ์");
                    }
                    const userNumber = yield (0, string_utils_1.generateId)("MMBU", userType);
                    const generatedPassword = (0, string_utils_1.generateRandomNumberPattern)('MM##########').toLowerCase();
                    const hashedPassword = yield bcrypt_1.default.hash(generatedPassword, 10);
                    const user = new user_model_1.default({
                        userNumber,
                        userType,
                        username: userNumber,
                        password: hashedPassword,
                        remark,
                        registration: platform,
                        isVerifiedEmail: false,
                        isVerifiedPhoneNumber: false,
                        acceptPolicyVersion,
                        acceptPolicyTime,
                    });
                    const business = new customerBusiness_model_1.default(Object.assign(Object.assign({}, businessDetail), { userNumber }));
                    if (businessDetail.paymentMethod === 'cash' && businessDetail.paymentCashDetail) {
                        const cashDetail = businessDetail.paymentCashDetail;
                        const cashPayment = new customerBusinessCashPayment_model_1.default({
                            userNumber,
                            acceptedEreceiptDate: cashDetail.acceptedEReceiptDate
                        });
                        yield cashPayment.save();
                    }
                    else if (businessDetail.paymentMethod === 'credit' && businessDetail.paymentCreditDetail) {
                        // TODO: Get default config
                        const _defaultCreditLimit = 20000.00;
                        const _billedDate = 1;
                        const _billedRound = 15;
                        const _a = businessDetail.paymentCreditDetail, { businessRegistrationCertificateFile, copyIDAuthorizedSignatoryFile, certificateValueAddedTaxRegistrationFile } = _a, creditDetail = __rest(_a, ["businessRegistrationCertificateFile", "copyIDAuthorizedSignatoryFile", "certificateValueAddedTaxRegistrationFile"]);
                        // Upload document
                        if (!businessRegistrationCertificateFile) {
                            throw new graphql_1.GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
                                extensions: {
                                    code: 'ERROR_VALIDATION',
                                    errors: [{ field: 'businessRegistrationCertificate', message: 'กรุณาอัพโหลดเอกสารสำเนาบัตรประชาชนผู้มีอำนาจลงนาม' }],
                                }
                            });
                        }
                        if (!copyIDAuthorizedSignatoryFile) {
                            throw new graphql_1.GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
                                extensions: {
                                    code: 'ERROR_VALIDATION',
                                    errors: [{ field: 'copyIDAuthorizedSignatory', message: 'กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม' }],
                                }
                            });
                        }
                        const businessRegisCertFileModel = new file_model_1.default(businessRegistrationCertificateFile);
                        const copyIDAuthSignatoryFileModel = new file_model_1.default(copyIDAuthorizedSignatoryFile);
                        const certValueAddedTaxRegisFileModel = certificateValueAddedTaxRegistrationFile ? new file_model_1.default(certificateValueAddedTaxRegistrationFile) : null;
                        yield businessRegisCertFileModel.save();
                        yield copyIDAuthSignatoryFileModel.save();
                        if (certValueAddedTaxRegisFileModel) {
                            yield certValueAddedTaxRegisFileModel.save();
                        }
                        const creditPayment = new customerBusinessCreditPayment_model_1.default(Object.assign(Object.assign(Object.assign({}, creditDetail), { billedDate: _billedDate, billedRound: _billedRound, creditLimit: _defaultCreditLimit, userNumber, creditUsage: 0, businessRegistrationCertificateFile: businessRegisCertFileModel, copyIDAuthorizedSignatoryFile: copyIDAuthSignatoryFileModel }), (certValueAddedTaxRegisFileModel ? { certificateValueAddedTaxRefistrationFile: certValueAddedTaxRegisFileModel } : {})));
                        yield creditPayment.save();
                    }
                    else {
                        throw new Error("ไม่พบข้อมูลการชำระ กรุณาติดต่อผู้ดูแลระบบ");
                    }
                    yield business.save();
                    yield user.save();
                    if (businessDetail.paymentMethod === 'cash') {
                        // Email sender
                        yield emailTranspoter.sendMail({
                            from: process.env.GOOGLE_MAIL,
                            to: businessDetail.businessEmail,
                            subject: 'ยืนยันการสมัครสมาชิก Movemate!',
                            template: 'register_business',
                            context: {
                                business_title: businessDetail.businessTitle,
                                business_name: businessDetail.businessName,
                                username: userNumber,
                                password: generatedPassword,
                                logo: imageUrl,
                                activate_link: `https://api.movemateth.com/activate/customer/${userNumber}`,
                                movemate_link: `https://www.movemateth.com`,
                            }
                        });
                    }
                    return { user, businessDetail: business };
                }
                return null;
            }
            catch (error) {
                console.log(error);
                throw error;
            }
        });
    }
    updateUser(_a) {
        return __awaiter(this, void 0, void 0, function* () {
            var { id } = _a, update_data = __rest(_a, ["id"]);
            try {
                const user = yield user_model_1.default.findByIdAndUpdate(id, update_data, {
                    new: true,
                });
                if (!user) {
                    throw new Error("User not found");
                }
                return user;
            }
            catch (error) {
                throw new Error("Failed to update user");
            }
        });
    }
};
__decorate([
    (0, type_graphql_1.Query)(() => [user_model_1.User]),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "users", null);
__decorate([
    (0, type_graphql_1.Query)(() => user_model_1.User),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Arg)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "user", null);
__decorate([
    (0, type_graphql_1.Query)(() => user_payloads_1.UserPayload),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "me", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => user_payloads_1.UserPayload),
    __param(0, (0, type_graphql_1.Arg)("data")),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_input_1.RegisterInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "register", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => user_model_1.User),
    (0, type_graphql_1.UseMiddleware)(auth_guards_1.AuthGuard),
    __param(0, (0, type_graphql_1.Arg)("data")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_input_1.UpdateUserInput]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "updateUser", null);
UserResolver = __decorate([
    (0, type_graphql_1.Resolver)(user_model_1.User)
], UserResolver);
exports.default = UserResolver;
//# sourceMappingURL=user.resolvers.js.map