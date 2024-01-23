import { Flex } from '@chakra-ui/react'

import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'

const ImportExportToolbar = (): JSX.Element => {
  return (
    <Flex justifyContent="center" alignItems="center">
      <ImportCsvButton />
      <ExportCsvButton />
    </Flex>
  )
}

export default ImportExportToolbar
