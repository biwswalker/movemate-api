import numeral from 'numeral'

type InputValue = string | number | null

export function fNumber(number: InputValue, format = '0') {
  return numeral(number).format(format)
}

export function fPercent(number: InputValue) {
  const format = number ? numeral(Number(number) / 100).format('0.0%') : ''

  return result(format, '.0')
}

export function fShortenNumber(number: InputValue) {
  const format = number ? numeral(number).format('0.00a') : ''
  if (number === 0) {
    return '0'
  }
  return result(format, '.00')
}

export function fData(number: InputValue) {
  const format = number ? numeral(number).format('0.0 b') : ''

  return result(format, '.0')
}

export function result(format: string, key = '.00') {
  const isInteger = format.includes(key)

  return isInteger ? format.replace(key, '') : format
}

export function fCurrency(number: string | number, isDecimal?: boolean) {
  return numeral(number).format((Number.isInteger(number) && !isDecimal) ? '0,0' : '0,0.00')
}

export function fCurrencyBaht(number: string | number) {
  const formatted = numeral(number).format(Number.isInteger(number) ? '0,0' : '0,0.00')
  return `${formatted} ฿`
}

export function formatPhoneNumber(phoneNumberString: string) {
  var cleaned = phoneNumberString.replace(/\D/g, '')
  var match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return match[1] + '-' + match[2] + '-' + match[3]
  }
  return phoneNumberString
}
