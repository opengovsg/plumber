import { Settings as LuxonSettings } from 'luxon'

type IntlProviderProps = {
  children: React.ReactNode
}

const TimezoneProvider = ({
  children,
}: IntlProviderProps): React.ReactElement => {
  // Force SGT date-time formatting no matter what
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'

  return <>{children}</>
}

export default TimezoneProvider
