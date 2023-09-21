import { Infobox } from '@opengovsg/design-system-react'

import { ContentProps } from '../types'

export default function Error(_props: ContentProps): JSX.Element {
  return (
    <Infobox variant="error">Error encountered. Please file a bug!</Infobox>
  )
}
