import { MiddlewareFn } from 'type-graphql'
import { verifyAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import UserModel from '@models/user.model'
import { NextFunction, Request, Response } from 'express';

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

export const AuthGuard: MiddlewareFn<GraphQLContext> = async ({ context }, next) => {
    const { req } = context

    const authorization = req.headers['authorization']
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new Error('รหัสระบุตัวตนไม่สมบูรณ์')
    }

    try {
        const token = authorization.split(' ')[1];
        const decodedToken = verifyAccessToken(token)
        if (!decodedToken) {
            throw new Error('รหัสระบุตัวตนไม่สมบูรณ์หรือหมดอายุ');
        }
        const user_id = decodedToken.user_id
        const user = await findUserById(UserModel, user_id);

        if (!user) {
            throw new Error('ไม่พบผู้ใช้');
        }

        req.user_id = user_id

    } catch (error) {
        console.log(error)
        throw new Error('รหัสระบุตัวตนไม่สมบูรณ์')
    }

    return next()
}

export const authenticateTokenAccessImage = async (request: Request, response: Response, next: NextFunction) => {
    const authorization = request.headers['authorization']

    if (!authorization || !authorization.startsWith('Bearer ') || authorization === undefined || authorization === null) {
        return response.sendStatus(401)
    }

    try {
        const token = authorization.split(' ')[1];
        const decodedToken = verifyAccessToken(token)
        if (!decodedToken) {
            return response.sendStatus(403)
        }
        const user_id = decodedToken.user_id

        const user = await findUserById(UserModel, user_id)

        if (!user) {
            return response.sendStatus(403)
        }

        next()
    } catch (error) {
        // console.log(error)
        return response.sendStatus(403)
    }
}