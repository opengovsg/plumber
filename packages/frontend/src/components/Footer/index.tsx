import { RestrictedFooter } from '@opengovsg/design-system-react'
import { FEEDBACK_FORM_LINK } from 'config/urls'

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
        href: '',
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
    ]}
    containerProps={{
      bg: 'primary.50',
    }}
  />
)
