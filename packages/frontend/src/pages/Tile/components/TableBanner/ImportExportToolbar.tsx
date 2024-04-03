import { HiOutlineDotsVertical } from 'react-icons/hi'
import { Flex, Hide, MenuButton, MenuList, Show } from '@chakra-ui/react'
import { ButtonProps, IconButton, Menu } from '@opengovsg/design-system-react'

import { useTableContext } from '../../contexts/TableContext'

import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'
import ShareButton from './ShareButton'

const MENU_ITEM_PROPS: ButtonProps = {
  justifyContent: 'flex-start',
  py: 5,
  borderRadius: 0,
}

const ImportExportToolbar = (): JSX.Element => {
  const { hasEditPermission } = useTableContext()

  return (
    <>
      <Show above="md">
        <Flex justifyContent="center" alignItems="center">
          {hasEditPermission && <ImportCsvButton />}
          <ExportCsvButton />
          {hasEditPermission && <ShareButton />}
        </Flex>
      </Show>
      <Hide above="md">
        <Menu>
          <MenuButton
            as={IconButton}
            colorScheme="secondary"
            variant="clear"
            icon={<HiOutlineDotsVertical />}
          />
          <MenuList display="flex" flexDir="column" borderRadius="md">
            {hasEditPermission && <ImportCsvButton {...MENU_ITEM_PROPS} />}
            <ExportCsvButton {...MENU_ITEM_PROPS} />
            {hasEditPermission && <ShareButton {...MENU_ITEM_PROPS} />}
          </MenuList>
        </Menu>
      </Hide>
    </>
  )
}

export default ImportExportToolbar
