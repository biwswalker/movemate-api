import { format, getTime, formatDistanceToNow, getYear, isSameDay, isSameMonth } from 'date-fns'

// ----------------------------------------------------------------------

type InputValue = Date | string | number | null

export function fDate(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'dd MMM yyyy'

  return date ? format(new Date(date), fm) : ''
}

export function fDateTime(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'dd MMM yyyy p'

  return date ? format(new Date(date), fm) : ''
}

export function fTimestamp(date: InputValue) {
  return date ? getTime(new Date(date)) : ''
}

export function fToNow(date: InputValue) {
  return date
    ? formatDistanceToNow(new Date(date), {
        addSuffix: true,
      })
    : ''
}

export function fRage(start: InputValue, end: InputValue) {
  const currentYear = new Date().getFullYear()
  const startDateYear = start ? getYear(start) : null
  const endDateYear = end ? getYear(end) : null
  const isCurrentYear = currentYear === startDateYear && currentYear === endDateYear

  const isSameDays = start && end ? isSameDay(new Date(start), new Date(end)) : false
  const isSameMonths = start && end ? isSameMonth(new Date(start), new Date(end)) : false

  const result =
    start && end
      ? isCurrentYear
        ? isSameMonths
          ? isSameDays
            ? fDate(end, 'dd MMM yy')
            : `${fDate(start, 'dd')} - ${fDate(end, 'dd MMM yy')}`
          : `${fDate(start, 'dd MMM')} - ${fDate(end, 'dd MMM yy')}`
        : `${fDate(start, 'dd MMM yy')} - ${fDate(end, 'dd MMM yy')}`
      : ''

  return result
}
