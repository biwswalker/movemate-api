import jwt from 'jsonwebtoken'
import CryptoJS from 'crypto-js'

export function encryption(encryptext: string) {
  const text = CryptoJS.AES.encrypt(encryptext, process.env.MOVEMATE_SHARED_KEY).toString()
  return text || ''
}

export function decryption(decryptext: string) {
  const text = CryptoJS.AES.decrypt(decryptext, process.env.MOVEMATE_SHARED_KEY).toString(CryptoJS.enc.Utf8)
  return text || ''
}

export function generateExpToken(data: Object, exp = '3d'): string {
  const SECRET_KEY = process.env.JWT_SECRET
  const token = jwt.sign(data, SECRET_KEY, { expiresIn: exp })
  return token
}

export function verifyExpToken<T = any>(token: string): T {
  const SECRET_KEY = process.env.JWT_SECRET
  const decoded = jwt.verify(token, SECRET_KEY)
  return decoded as T
}
