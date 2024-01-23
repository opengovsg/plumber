import { Flex } from '@chakra-ui/react'

import EditMode from './EditMode'
import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'

const ImportExportToolbar = (): JSX.Element => {
  return (
    <Flex justifyContent="center" alignItems="center">
      <EditMode />
      <ImportCsvButton />
      <ExportCsvButton />
    </Flex>
  )
}

export default ImportExportToolbar
