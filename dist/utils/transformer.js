"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const isArray = (array) => Array.isArray(array);
const isObject = (object) => object === Object(object) && !isArray(object) && typeof object !== "function";
const snakeToCamelcaseTransform = (data) => {
    if (isObject(data)) {
        const objectData = data;
        const newObject = {};
        (0, lodash_1.keys)(objectData).forEach((key) => {
            newObject[(0, lodash_1.camelCase)(key)] = snakeToCamelcaseTransform(objectData[key]);
        });
        return newObject;
    }
    else if (isArray(data)) {
        const arrayData = data;
        const newArray = arrayData.map((i) => snakeToCamelcaseTransform(i));
        return newArray;
    }
    return data;
};
const customSnakeCase = (key) => {
    const customSnakeCaseString = (0, lodash_1.chain)(key)
        .split(/(\d+)/)
        .map(lodash_1.snakeCase)
        .join("")
        .value();
    return customSnakeCaseString;
};
const camelToSnakecaseTransform = (data) => {
    if (isObject(data)) {
        const objectData = data;
        const newObject = {};
        (0, lodash_1.keys)(objectData).forEach((key) => {
            newObject[customSnakeCase(key)] = camelToSnakecaseTransform(objectData[key]);
        });
        return newObject;
    }
    else if (isArray(data)) {
        const arrayData = data;
        const newArray = arrayData.map((i) => camelToSnakecaseTransform(i));
        return newArray;
    }
    return data;
};
const transformer = {
    snakeToCamelcaseTransform,
    camelToSnakecaseTransform,
};
exports.default = transformer;
//# sourceMappingURL=transformer.js.map