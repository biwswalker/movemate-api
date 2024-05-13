import jwt from 'jsonwebtoken'

export function generateAccessToken(user_id: string): string {
    const SECRET_KEY = process.env.JWT_SECRET
    const token = jwt.sign({ user_id }, SECRET_KEY, { expiresIn: '1d' })
    return token
}

export function verifyAccessToken(token: string): { user_id: string } {
    const SECRET_KEY = process.env.JWT_SECRET
    const decoded = jwt.verify(token, SECRET_KEY) as { user_id: string }
    return decoded
}