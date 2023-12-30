import jwt from 'jsonwebtoken'

export function generateAccessToken(user_id: string, user_role: TUserRole): string {
    const SECRET_KEY = process.env.JWT_SECRET
    const token = jwt.sign({ user_id, user_role }, SECRET_KEY, { expiresIn: '1d' })
    return token
}

export function verifyAccessToken(token: string): { user_id: string, user_role: TUserRole } {
    const SECRET_KEY = process.env.JWT_SECRET
    const decoded = jwt.verify(token, SECRET_KEY) as { user_id: string, user_role: TUserRole }
    return decoded
}