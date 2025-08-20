import jwt from 'jsonwebtoken'
import CryptoJS from 'crypto-js'

export function encryption(encryptext: string) {
  if (!encryptext) {
    return '';
  }
  try {
    const sanitizedText = encryptext.replace(/ /g, '+');
    const text = CryptoJS.AES.encrypt(sanitizedText, process.env.MOVEMATE_SHARED_KEY).toString()
    return text || '';
  } catch (error) {
    console.error('CryptoJS encrypt error:', error);
    return '';
  }
}

export function decryption(decryptext: string): string {
  if (!decryptext) {
    return '';
  }
  try {
    const sanitizedText = decryptext.replace(/ /g, '+');
    const text = CryptoJS.AES.decrypt(sanitizedText, process.env.MOVEMATE_SHARED_KEY).toString(CryptoJS.enc.Utf8);
    return text || '';
  } catch (error) {
    console.error('CryptoJS decryption error:', error);
    return '';
  }
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
