import { MessageDescriptor, useIntl } from 'react-intl'

type Values = {
  [key: string]: any
}

export default function useFormatMessage(): (
  id: string | MessageDescriptor,
  values?: Values,
) => string {
  const { formatMessage } = useIntl()

  return (id: string | MessageDescriptor, values: Values = {}) => {
    if (typeof id === 'string') {
      return formatMessage({ id }, values)
    } else {
      return formatMessage(id, values)
    }
  }
}
