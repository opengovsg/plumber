import { Image, Stack, Text, VStack } from '@chakra-ui/react'
import spreadsheetImg from 'assets/spreadsheet.png'

import styles from './UnauthorizedTile.module.css'

function UnauthorizedTile(): JSX.Element {
  return (
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
          Your{' '}
          <Text
            bgGradient="linear(to-r, primary.400, primary.500)"
            backgroundClip="text"
            as="span"
            className={styles.flicker}
            fontWeight="bold"
          >
            Tiles
          </Text>{' '}
          link is invalid or has expired.
        </Text>
        <Text
          textStyle="h6"
          textAlign={{ base: 'center', md: 'left' }}
          fontWeight="normal"
        >
          Please request a new link from the tile owner.
        </Text>
      </VStack>
    </Stack>
  )
}
export default UnauthorizedTile
