import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import Markdown from 'react-markdown'
import { Infobox } from '@opengovsg/design-system-react'

import { getStaticSensitiveHeaderKeys } from '@/helpers/customApiSensitiveHeaders'

function CustomApiSensitiveHeadersWarning(): JSX.Element | null {
  const customHeaders = useWatch({ name: 'parameters.customHeaders' })
  const sensitiveKeys = useMemo(
    () => getStaticSensitiveHeaderKeys(customHeaders),
    [customHeaders],
  )

  if (sensitiveKeys.length === 0) {
    return null
  }

  const headerList = sensitiveKeys.map((key) => `\`${key}\``).join(', ')

  return (
    <Infobox variant="warning" mt={4}>
      <Markdown>
        {`${headerList} should be stored in a Custom API connection, not in Custom Headers. Published pipes will keep running, but **Check step** will fail until you move these headers.`}
      </Markdown>
    </Infobox>
  )
}

export default CustomApiSensitiveHeadersWarning
