import { Settings as LuxonSettings } from 'luxon'

const TimezoneProvider = ({ children }: { children: React.ReactNode }) => {
  // Force SGT date-time formatting no matter what
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'

  return <>{children}</>
}

export default TimezoneProvider
