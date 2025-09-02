import { DateTime, LocaleOptions } from 'luxon'

declare module 'luxon' {
  interface DateTime {
    toPlumberFormat(fmt: string, opts?: LocaleOptions): string
  }
}

DateTime.prototype.toPlumberFormat = function (
  fmt: string,
  opts?: LocaleOptions,
): string {
  return this.toFormat(fmt, {
    locale: 'en-SG',
    ...opts,
  }).replace(/Sept(?!e)/, 'Sep')
}
