import jwt from 'jsonwebtoken'

export function generateAccessToken(user_id: string, user_role: string): string {
    const SECRET_KEY = process.env.JWT_SECRET
    // TODO: Change expiresIn to 1d and handle refresh token
    const token = jwt.sign({ user_id, user_role }, SECRET_KEY, { expiresIn: '30d' })
    return token
}

export function verifyAccessToken(token: string): { user_id: string, user_role: string } {
    const SECRET_KEY = process.env.JWT_SECRET
    const decoded = jwt.verify(token, SECRET_KEY) as { user_id: string, user_role: string }
    return decoded
}