import { MiddlewareFn } from 'type-graphql'
import { verifyAccessToken } from '@utils/auth.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import UserModel from '@models/user.model'
import DriverModel from '@models/driver.model'

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
        throw new Error('Authorization token is missing or invalid')
    }

    try {
        const token = authorization.split(' ')[1];
        const decodedToken = verifyAccessToken(token)
        if (!decodedToken) {
            throw new Error('Invalid token');
        }
        const user_id = decodedToken.user_id
        const role = decodedToken.role
        let user

        switch (role) {
            case 'customer':
                user = await findUserById(UserModel, user_id);
                break;
            case 'driver':
                user = await findUserById(DriverModel, user_id);
                break;
            case 'admin':
                // user = await findUserById(AdminModel, user_id);
                // break;
                throw new Error('Unauthorized');
            default:
                throw new Error('Unauthorized');
        }

        if (!user) {
            throw new Error('Unauthorized');
        }

        req.user_id = user_id

    } catch (error) {
        throw new Error('Invalid access token')
    }

    return next()
}