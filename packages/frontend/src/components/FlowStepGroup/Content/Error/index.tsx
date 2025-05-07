import { Infobox } from '@opengovsg/design-system-react'

export default function Error(): JSX.Element {
  return (
    <Infobox borderTopRadius="lg" variant="error">
      Error encountered. Please file a bug!
    </Infobox>
  )
}
