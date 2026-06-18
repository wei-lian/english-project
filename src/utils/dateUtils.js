export function formatDate(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(input, days) {
  const date = input instanceof Date ? new Date(input) : new Date(input)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function startOfDay(input = new Date()) {
  const date = input instanceof Date ? new Date(input) : new Date(input)
  date.setHours(0, 0, 0, 0)
  return date
}

export function diffDays(a, b) {
  const first = startOfDay(a)
  const second = startOfDay(b)
  return Math.round((first - second) / (1000 * 60 * 60 * 24))
}

export function getRecentDateList(days, anchor = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const offset = days - index - 1
    return addDays(anchor, -offset)
  })
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

