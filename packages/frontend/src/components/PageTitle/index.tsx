import * as React from 'react'
import { Flex, Hide, Text } from '@chakra-ui/react'
import NavigationDrawer from 'components/Layout/NavigationDrawer'

interface PageTitleProps {
  title: string
}

export default function PageTitle(props: PageTitleProps): React.ReactElement {
  const { title } = props
  return (
    <Flex alignItems="center">
      <Hide above="sm">
        <NavigationDrawer />
      </Hide>
      <Text textStyle="h4">{title}</Text>
    </Flex>
  )
}
