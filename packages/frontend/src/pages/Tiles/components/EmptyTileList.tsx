import { Image, Stack, Text, VStack } from '@chakra-ui/react'
import spreadsheetImg from 'assets/spreadsheet.png'

import CreateTileButton from './CreateTileButton'

const EmptyTileList = (): JSX.Element => {
  return (
    <Stack
      direction={{ base: 'column', md: 'row' }}
      maxW="1000px"
      margin="auto"
      mt="10vh"
      gap={8}
      px={8}
      alignItems="center"
      justifyContent="center"
    >
      <Image src={spreadsheetImg} alt="Spreadsheet" w="400px" maxW="50vw" />
      <VStack alignItems={{ base: 'center', md: 'start' }} gap={8}>
        <Text
          textStyle="h4"
          textAlign={{ base: 'center', md: 'left' }}
          fontWeight="normal"
        >
          <Text
            bgGradient="linear(to-r, primary.400, primary.500)"
            backgroundClip="text"
            as="span"
            fontWeight="bold"
          >
            Tiles
          </Text>{' '}
          is a simple database to view, store and automate your data — all in
          one place.
        </Text>
        <CreateTileButton />
      </VStack>
    </Stack>
  )
}

export default EmptyTileList
