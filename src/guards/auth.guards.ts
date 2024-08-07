import { AuthenticationError, MiddlewareFn } from "type-graphql";
import { verifyAccessToken } from "@utils/auth.utils";
import { GraphQLContext } from "@configs/graphQL.config";
import UserModel, { User } from "@models/user.model";
import { NextFunction, Request, Response } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { includes } from "lodash";

export const AuthGuard: (roles?: TUserRole[]) => MiddlewareFn<GraphQLContext> =
  (roles = ["customer"]) =>
    async ({ context }, next) => {
      const { req } = context;

      const authorization = req.headers["authorization"];
      if (!authorization || !authorization.startsWith("Bearer ")) {
        throw new AuthenticationError("รหัสระบุตัวตนไม่สมบูรณ์");
      }

      try {
        const token = authorization.split(" ")[1];
        const decodedToken = verifyAccessToken(token);
        if (!decodedToken) {
          throw new AuthenticationError("รหัสระบุตัวตนไม่สมบูรณ์หรือหมดอายุ");
        }
        const user_id = decodedToken.user_id;
        const user_role = decodedToken.user_role;
        const user = await UserModel.findById(user_id).lean()

        if (!user) {
          throw new AuthenticationError("ไม่พบผู้ใช้");
        }

        if (!includes(roles, user_role)) {
          throw new AuthenticationError(
            "ไม่สามารถใช้งานฟังก์ชั้นนี้ได้ เนื่องจากจำกัดสิทธิ์การเข้าถึง"
          );
        }

        const limit = user.userType === 'business' ? Infinity : user.userType === 'individual' ? 20 : 10
        req.user_id = user_id;
        req.user_role = user_role;
        req.limit = limit
      } catch (error) {
        if (error instanceof TokenExpiredError) {
          throw new AuthenticationError("เซสชั่นหมดอายุ");
        }
        throw error;
      }

      return next();
    };

export const AllowGuard: MiddlewareFn<GraphQLContext> = async (
  { context },
  next
) => {
  const { req } = context;

  const authorization = req.headers["authorization"];

  try {
    if (authorization) {
      if (!authorization.startsWith("Bearer ")) {
        throw new AuthenticationError("รหัสระบุตัวตนไม่สมบูรณ์");
      }
      const token = authorization.split(" ")[1];
      const decodedToken = verifyAccessToken(token);
      if (decodedToken) {
        const user_id = decodedToken.user_id;
        const user_role = decodedToken.user_role;
        const user = await UserModel.findById(user_id).lean()

        const limit = user.userType === 'business' ? Infinity : user.userType === 'individual' ? 20 : 10
        req.user_id = user_id;
        req.user_role = user_role;
        req.limit = limit
      }
    }
    return next();
  } catch (error) {
    console.log("error: ", error);
    // if (error instanceof TokenExpiredError) {
    //   return next();
    // }
    // throw error;
    req.limit = 10;
    return next()
  }
};

export const authenticateTokenAccessImage = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  next();
  // const authorization = request.headers['authorization']

  // if (!authorization || !authorization.startsWith('Bearer ') || authorization === undefined || authorization === null) {
  //     return response.sendStatus(401)
  // }

  // try {
  //     const token = authorization.split(' ')[1];
  //     const decodedToken = verifyAccessToken(token)
  //     if (!decodedToken) {
  //         return response.sendStatus(403)
  //     }
  //     const user_id = decodedToken.user_id

  //     const user = await findUserById(UserModel, user_id)

  //     if (!user) {
  //         return response.sendStatus(403)
  //     }

  //     next()
  // } catch (error) {
  //     // console.log(error)
  //     return response.sendStatus(403)
  // }
};
