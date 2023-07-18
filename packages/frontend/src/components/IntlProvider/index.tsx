import { IntlProvider as BaseIntlProvider } from 'react-intl'
import englishMessages from 'locales/en.json'
import { Settings as LuxonSettings } from 'luxon'

type IntlProviderProps = {
  children: React.ReactNode
}

const IntlProvider = ({ children }: IntlProviderProps): React.ReactElement => {
  // Force SGT date-time formatting no matter what
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'

  return (
    <BaseIntlProvider
      locale={navigator.language}
      defaultLocale="en"
      messages={englishMessages}
      onError={() => null}
    >
      {children}
    </BaseIntlProvider>
  )
}

export default IntlProvider
