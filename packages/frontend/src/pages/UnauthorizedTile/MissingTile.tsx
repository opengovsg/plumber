import { Helmet } from 'react-helmet'
import { Image, Stack, Text, VStack } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'

import spreadsheetImg from '@/assets/spreadsheet.png'
import * as URLS from '@/config/urls'

import styles from './UnauthorizedTile.module.css'

interface MissingTileProps {
  title: string
}

export function MissingTile({ title }: MissingTileProps): JSX.Element {
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
        <Image
          className={styles.flicker}
          src={spreadsheetImg}
          alt="Spreadsheet"
          w="400px"
          maxW="50%"
        />
        <VStack alignItems={{ base: 'center', md: 'start' }} gap={2}>
          <Text
            textStyle="h4"
            textAlign={{ base: 'center', md: 'left' }}
            fontWeight="normal"
          >
            {title}
          </Text>
          <Link
            textStyle="h6"
            textAlign={{ base: 'center', md: 'left' }}
            fontWeight="normal"
            href={URLS.TILES}
          >
            Back to your Tiles
          </Link>
        </VStack>
      </Stack>
    </>
  )
}
