import CryptoJS from 'crypto-js'

export function encryption(encryptext: string) {
  const text = CryptoJS.AES.encrypt(
    encryptext,
    process.env.MOVEMATE_SHARED_KEY,
  ).toString()
  return text || ''
}

export function decryption(decryptext: string) {
  const text = CryptoJS.AES.decrypt(
    decryptext,
    process.env.MOVEMATE_SHARED_KEY,
  ).toString(CryptoJS.enc.Utf8)
  return text || ''
}
