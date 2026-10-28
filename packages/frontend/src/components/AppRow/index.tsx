import {
  Box,
  Card,
  CardBody,
  Center,
  Flex,
  Icon,
  Spacer,
  Text,
} from '@chakra-ui/react'
import type { IApp } from '@plumber/types'
import { ReactElement } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { Link } from 'react-router-dom'

import AppIcon from '@/components/AppIcon'
import * as URLS from '@/config/urls'

type AppRowProps = {
  application: IApp
}

function AppRow(props: AppRowProps): ReactElement {
  const { name, key, iconUrl, connectionCount, flowCount } = props.application

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
          <Flex gap={6} alignItems="center" py={6} pl={8} pr={0}>
            <AppIcon name={name} url={iconUrl} />

            <Flex gap={2} flexDir="column">
              <Text textStyle="subhead-1">{name}</Text>

              <Flex
                alignItems="center"
                gap={1}
                textStyle="body-2"
                color="base.content.medium"
              >
                <Text>{connectionCount} connections</Text>
                <Box
                  boxSize="2px"
                  borderRadius="full"
                  bg="currentColor"
                  mx={1}
                />
                <Text>{flowCount} pipes</Text>
              </Flex>
            </Flex>

            <Spacer />

            <Center boxSize={10} color="secondary.500">
              <Icon as={BiChevronRight} boxSize={5} aria-hidden />
            </Center>
          </Flex>
        </CardBody>
      </Card>
    </Link>
  )
}

export default AppRow
