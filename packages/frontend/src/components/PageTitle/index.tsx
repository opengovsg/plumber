import * as React from 'react'
import { Text } from '@chakra-ui/react'

interface PageTitleProps {
  title: string
}

export default function PageTitle(props: PageTitleProps): React.ReactElement {
  const { title } = props
  return <Text textStyle="h4">{title}</Text>
}
