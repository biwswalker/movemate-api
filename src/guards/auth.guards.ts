import { AuthenticationError, MiddlewareFn } from 'type-graphql'
import { verifyAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import UserModel from '@models/user.model'
import { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { includes } from 'lodash';

interface IAccountModel {
    findById(user_id: string): Promise<any>;
}

const findUserById = async (Model: IAccountModel, user_id: string): Promise<any> => {
    const user = await Model.findById(user_id);
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
};

export const AuthGuard: (roles?: TUserRole[]) => MiddlewareFn<GraphQLContext> = (roles = ['customer']) => async ({ context }, next) => {
    const { req } = context

    const authorization = req.headers['authorization']
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new AuthenticationError('รหัสระบุตัวตนไม่สมบูรณ์')
    }

    try {
        const token = authorization.split(' ')[1];
        const decodedToken = verifyAccessToken(token)
        if (!decodedToken) {
            throw new AuthenticationError('รหัสระบุตัวตนไม่สมบูรณ์หรือหมดอายุ');
        }
        const user_id = decodedToken.user_id
        const user_role = decodedToken.user_role
        const user = await findUserById(UserModel, user_id);

        if (!user) {
            throw new AuthenticationError('ไม่พบผู้ใช้');
        }

        if (!includes(roles, user_role)) {
            throw new AuthenticationError('ไม่สามารถใช้งานฟังก์ชั้นนี้ได้ จำกัดสิทธิ์การเข้าถึง');
        }

        req.user_id = user_id
        req.user_role = user_role

    } catch (error) {
        if (error instanceof TokenExpiredError) {
            throw new AuthenticationError('เซสชั่นหมดอายุ');
        }
        throw error
    }

    return next()
}

export const authenticateTokenAccessImage = async (request: Request, response: Response, next: NextFunction) => {
    next()
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
}