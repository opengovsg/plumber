import { RestrictedFooter } from '@opengovsg/design-system-react'

import appConfig from '@/config/app'
import {
  FEEDBACK_FORM_LINK,
  GUIDE_LINK,
  PRIVACY_STATEMENT_LINK,
  TERMS_OF_USE_LINK,
} from '@/config/urls'

export const Footer = () => (
  <RestrictedFooter
    appName="Plumber"
    appLink={window.location.origin}
    footerLinks={[
      {
        label: 'Contact',
        href: FEEDBACK_FORM_LINK,
      },
      {
        label: 'Guide',
        href: GUIDE_LINK,
      },
      {
        label: 'Privacy',
        href: PRIVACY_STATEMENT_LINK,
      },
      {
        label: 'Terms of Use',
        href: TERMS_OF_USE_LINK,
      },
      {
        label: 'Report Vulnerability',
        href: 'https://www.tech.gov.sg/report_vulnerability',
      },
      {
        label: `${appConfig.version}-${appConfig.env}`,
        href: '',
      },
    ]}
    containerProps={{
      bg: 'primary.50',
    }}
  />
)
