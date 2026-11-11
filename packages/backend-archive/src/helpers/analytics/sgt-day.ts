import { DateTime } from 'luxon'

const ZONE = 'Asia/Singapore'
const DAY_FORMAT = 'yyyy-MM-dd'

export interface SgtDayWindow {
  start: Date
  end: Date
}

function parseDay(day: string): DateTime {
  const start = DateTime.fromFormat(day, DAY_FORMAT, { zone: ZONE })
  if (!start.isValid) {
    throw new Error(`Invalid day "${day}". Use YYYY-MM-DD.`)
  }
  return start
}

export function sgtDayWindow(day: string): SgtDayWindow {
  const start = parseDay(day)
  return {
    start: start.toJSDate(),
    end: start.plus({ days: 1 }).toJSDate(),
  }
}

export function previousSgtDay(now: Date): string {
  return DateTime.fromJSDate(now, { zone: ZONE })
    .minus({ days: 1 })
    .toFormat(DAY_FORMAT)
}

// Every day after `after`, through `through`. Empty when `after` is not earlier.
export function sgtDaysAfter(after: string, through: string): string[] {
  const end = parseDay(through)
  const days: string[] = []
  for (let day = parseDay(after).plus({ days: 1 }); day <= end;) {
    days.push(day.toFormat(DAY_FORMAT))
    day = day.plus({ days: 1 })
  }
  return days
}
