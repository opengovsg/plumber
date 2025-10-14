const isInt = (value: number) => Number.isInteger(value)

// Unified validator: validates either YYYY-MM or YYYY-MM-DD depending on kind
export const isValidDateString = (
  value: string,
  kind: 'year_month' | 'date',
): boolean => {
  const parts = value.split('-')
  const [yearStr, monthStr, dayStr] = parts

  switch (kind) {
    case 'year_month': {
      if (parts.length !== 2) {
        return false
      }
      const year = Number(yearStr)
      const month = Number(monthStr)
      if (!isInt(year) || !isInt(month)) {
        return false
      }
      return month >= 1 && month <= 12
    }
    case 'date': {
      if (parts.length !== 3) {
        return false
      }
      const year = Number(yearStr)
      const month = Number(monthStr)
      const day = Number(dayStr)
      if (!isInt(year) || !isInt(month) || !isInt(day)) {
        return false
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false
      }
      const date = new Date(Date.UTC(year, month - 1, day))
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      )
    }
  }
}

// Validate HH:MM:SS ranges
export const isValidTimeString = (value: string): boolean => {
  const [hhStr, mmStr, ssStr] = value.split(':')
  const hh = Number(hhStr)
  const mm = Number(mmStr)
  const ss = Number(ssStr)
  if (!isInt(hh) || !isInt(mm) || !isInt(ss)) {
    return false
  }
  if (hh < 0 || hh > 23) {
    return false
  }
  if (mm < 0 || mm > 59) {
    return false
  }
  if (ss < 0 || ss > 59) {
    return false
  }
  return true
}

// Validate YYYY-MM-DDTHH:MM:SS+HH:MM (basic logical checks)
export const isValidDateTimeString = (value: string): boolean => {
  const [datePart, timeAndOffset] = value.split('T')
  if (!datePart || !timeAndOffset) {
    return false
  }
  if (!isValidDateString(datePart, 'date')) {
    return false
  }
  const [timePart, offsetPart] = timeAndOffset.split('+')
  if (!timePart || !offsetPart) {
    return false
  }
  if (!isValidTimeString(timePart)) {
    return false
  }
  const [offHStr, offMStr] = offsetPart.split(':')
  const offH = Number(offHStr)
  const offM = Number(offMStr)
  if (!isInt(offH) || !isInt(offM)) {
    return false
  }
  // Accept common range of UTC offsets
  if (offH < 0 || offH > 14) {
    return false
  }
  if (offM < 0 || offM > 59) {
    return false
  }
  return true
}
