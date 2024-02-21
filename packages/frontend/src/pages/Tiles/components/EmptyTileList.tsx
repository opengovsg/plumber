import { Image, Text, VStack } from '@chakra-ui/react'
import spreadsheetImg from 'assets/spreadsheet.png'

import CreateTileButton from './CreateTileButton'

const EmptyTileList = (): JSX.Element => {
  return (
    <VStack
      maxW="600px"
      margin="auto"
      gap={8}
      px={8}
      alignItems="center"
      justifyContent="center"
    >
      <Image src={spreadsheetImg} alt="Spreadsheet" w="400px" maxW="50vw" />
      <Text textStyle="h4" textAlign="center" fontWeight="normal">
        <Text
          bgGradient="linear(to-r, primary.400, primary.600)"
          backgroundClip="text"
          as="span"
          fontWeight="bold"
        >
          Tiles
        </Text>{' '}
        is a simple database to view, store and automate your data — all in one
        place.
      </Text>
      <CreateTileButton />
    </VStack>
  )
}

export default EmptyTileList
