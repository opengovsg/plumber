import { Link } from '@opengovsg/design-system-react'

export const generateExternalLink = (link: string) => (str: string) =>
  (
    <Link href={link} target="_blank">
      {str}
    </Link>
  )
