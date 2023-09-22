import type { IApp } from '@plumber/types'

import { ReactElement } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import {
  Card,
  CardBody,
  Center,
  Flex,
  Icon,
  Spacer,
  Text,
} from '@chakra-ui/react'
import AppIcon from 'components/AppIcon'
import * as URLS from 'config/urls'

type AppRowProps = {
  application: IApp
}

function AppRow(props: AppRowProps): ReactElement {
  const { name, key, primaryColor, iconUrl, connectionCount, flowCount } =
    props.application

  return (
    <Link to={URLS.APP(key)} data-test="app-row">
      <Card
        boxShadow="none"
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        borderRadius={0}
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
      >
        <CardBody p={0}>
          <Flex gap={6} alignItems="center" py={6} px={8}>
            <AppIcon name={name} url={iconUrl} color={primaryColor} />

            <Flex gap={2} flexDir="column">
              <Text textStyle="subhead-1">{name}</Text>

              <Flex gap={4} textStyle="body-2">
                <Text>{connectionCount} connections</Text>
                <Text>{flowCount} pipes</Text>
              </Flex>
            </Flex>

            <Spacer />

            <Center p={3}>
              <Icon boxSize={5} as={BiChevronRight} />
            </Center>
          </Flex>
        </CardBody>
      </Card>
    </Link>
  )
}

export default AppRow
