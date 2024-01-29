import { Flex } from '@chakra-ui/react'

import EditMode from './EditMode'
import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'
import ShareButton from './ShareButton'

const ImportExportToolbar = (): JSX.Element => {
  return (
    <Flex justifyContent="center" alignItems="center">
      <EditMode />
      <ImportCsvButton />
      <ExportCsvButton />
      <ShareButton />
    </Flex>
  )
}

export default ImportExportToolbar
