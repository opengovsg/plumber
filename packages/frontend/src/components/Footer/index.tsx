// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Not sure why the types for restricted footer not exported properly

import {
  RestrictedFooter,
  RestrictedOgpLogoFullBlack,
} from '@opengovsg/design-system-react'
import { FEEDBACK_FORM_LINK, OGP_HOMEPAGE } from 'config/urls'

export const Footer = () => (
  <RestrictedFooter
    appName="Plumber"
    appLink={window.location.origin}
    textColorScheme="secondary"
    colorMode="light"
    // also not sure why it defaults to reverse logo colour
    footerIconLink={{
      href: OGP_HOMEPAGE,
      Icon: RestrictedOgpLogoFullBlack,
    }}
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
