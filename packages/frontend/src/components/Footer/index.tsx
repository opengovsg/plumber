import { RestrictedFooter } from '@opengovsg/design-system-react'
import appConfig from 'config/app'
import { FEEDBACK_FORM_LINK, GUIDE_LINK } from 'config/urls'

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
        href: 'https://hack.gov.sg/2023/HFPGprivacy',
      },
      {
        label: 'Terms of Use',
        href: 'https://hack.gov.sg/2023/HFPGTC/',
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
