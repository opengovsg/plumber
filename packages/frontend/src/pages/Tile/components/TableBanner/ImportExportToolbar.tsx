import { Flex } from '@chakra-ui/react'

import { useTableContext } from '../../contexts/TableContext'

import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'
import ShareButton from './ShareButton'

const ImportExportToolbar = (): JSX.Element => {
  const { hasEditPermission } = useTableContext()

  return (
    <Flex justifyContent="center" alignItems="center">
      {hasEditPermission && <ImportCsvButton />}
      <ExportCsvButton />
      {hasEditPermission && <ShareButton />}
    </Flex>
  )
}

export default ImportExportToolbar
