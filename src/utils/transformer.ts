import { camelCase, keys, chain, snakeCase } from "lodash";

const isArray = (array: any) => Array.isArray(array);

const isObject = (object: any) =>
  object === Object(object) && !isArray(object) && typeof object !== "function";

const snakeToCamelcaseTransform = (data: any): { [name: string]: any } | [] => {
  if (isObject(data)) {
    const objectData = data as { [name: string]: any };
    const newObject: { [name: string]: any } = {};
    keys(objectData).forEach((key) => {
      newObject[camelCase(key)] = snakeToCamelcaseTransform(objectData[key]);
    });
    return newObject;
  } else if (isArray(data)) {
    const arrayData = data as [];
    const newArray = arrayData.map((i) => snakeToCamelcaseTransform(i));
    return newArray;
  }
  return data;
};

const customSnakeCase = (key: string) => {
  const customSnakeCaseString = chain(key)
    .split(/(\d+)/)
    .map(snakeCase)
    .join("")
    .value();
  return customSnakeCaseString;
};

const camelToSnakecaseTransform = (data: any): { [name: string]: any } | [] => {
  if (isObject(data)) {
    const objectData = data as { [name: string]: any };
    const newObject: { [name: string]: any } = {};
    keys(objectData).forEach((key) => {
      newObject[customSnakeCase(key)] = camelToSnakecaseTransform(
        objectData[key]
      );
    });
    return newObject;
  } else if (isArray(data)) {
    const arrayData = data as [];
    const newArray = arrayData.map((i) => camelToSnakecaseTransform(i));
    return newArray;
  }
  return data;
};

const transformer = {
  snakeToCamelcaseTransform,
  camelToSnakecaseTransform,
};

export default transformer;
