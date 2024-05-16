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
Object.defineProperty(exports, "__esModule", { value: true });
const type_graphql_1 = require("type-graphql");
const graphql_upload_ts_1 = require("graphql-upload-ts");
const fs_1 = require("fs");
const string_utils_1 = require("@utils/string.utils");
const path_1 = require("path");
const file_payloads_1 = require("@payloads/file.payloads");
let MapsResolver = class MapsResolver {
    file_upload(file, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            // const userId = ctx.req.user_id
            const { filename, mimetype, createReadStream } = yield file;
            const generated_filename = yield (0, string_utils_1.generateId)(`${(0, string_utils_1.generateRandomNumberPattern)('MMSOURCE######')}-`, 'upload');
            const final_filename = `${generated_filename}${(0, path_1.extname)(filename)}`;
            const path = (0, path_1.join)(__dirname, '..', '..', 'uploads', final_filename);
            const url = `${process.env.DOMAINNAME}/source/${final_filename}`;
            return yield new Promise((resolve, reject) => {
                createReadStream()
                    .pipe((0, fs_1.createWriteStream)(path))
                    .on('finish', () => __awaiter(this, void 0, void 0, function* () {
                    resolve({
                        fileId: generated_filename,
                        filename: final_filename,
                        mimetype,
                        url
                    });
                }))
                    .on('error', (error) => {
                    console.log('error: ', error);
                    reject();
                });
            });
        });
    }
};
__decorate([
    (0, type_graphql_1.Mutation)(() => file_payloads_1.FileUploadPayload)
    // @UseMiddleware(AuthGuard) // TODO: Must fixed request url source
    ,
    __param(0, (0, type_graphql_1.Arg)('file', () => graphql_upload_ts_1.GraphQLUpload)),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MapsResolver.prototype, "file_upload", null);
MapsResolver = __decorate([
    (0, type_graphql_1.Resolver)()
], MapsResolver);
exports.default = MapsResolver;
//# sourceMappingURL=file.resolvers.js.map