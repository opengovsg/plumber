import { Helmet } from 'react-helmet'
import { Box, Stack, Text, VStack } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'

import { PipeIcon } from '@/components/Icons/PipeIcon'
import * as URLS from '@/config/urls'
import styles from '@/pages/UnauthorizedTile/UnauthorizedTile.module.css'

export default function InvalidEditorPage() {
  return (
    <>
      <Helmet>
        <title>you seem lost...</title>
      </Helmet>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        maxW="1000px"
        margin="auto"
        gap={8}
        px={8}
        alignItems="center"
        justifyContent="center"
      >
        <Box
          className={styles.flicker}
          as={PipeIcon}
          color="primary.300"
          w="400px"
          h="200px"
          maxW="50vw"
        />
        <VStack alignItems={{ base: 'center', md: 'start' }} gap={2}>
          <Text
            textStyle="h4"
            textAlign={{ base: 'center', md: 'left' }}
            fontWeight="normal"
          >
            Pipe not found, you may have transferred it to someone else 🤔
          </Text>
          <Link
            textStyle="h6"
            textAlign={{ base: 'center', md: 'left' }}
            fontWeight="normal"
            href={URLS.FLOWS}
          >
            Back to your Pipes
          </Link>
        </VStack>
      </Stack>
    </>
  )
}
