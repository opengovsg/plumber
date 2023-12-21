import { BiChevronDown, BiExport, BiImport } from 'react-icons/bi'
import { Flex, Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import ExportCsvButton from './ExportCsvButton'
import ImportCsvButton from './ImportCsvButton'

const ImportExportToolbar = (): JSX.Element => {
  return (
    <Flex justifyContent="center" alignItems="center">
      <Menu gutter={0} colorScheme="secondary">
        <MenuButton
          as={Button}
          variant="clear"
          size="xs"
          colorScheme="secondary"
          leftIcon={<BiImport />}
          rightIcon={<BiChevronDown />}
        >
          Import
        </MenuButton>
        <MenuList borderRadius="md">
          <MenuItem as={ImportCsvButton} />
        </MenuList>
      </Menu>
      <Menu gutter={0} colorScheme="secondary">
        <MenuButton
          as={Button}
          variant="clear"
          size="xs"
          colorScheme="secondary"
          leftIcon={<BiExport />}
          rightIcon={<BiChevronDown />}
        >
          Export
        </MenuButton>
        <MenuList borderRadius="md">
          <MenuItem as={ExportCsvButton} />
        </MenuList>
      </Menu>
    </Flex>
  )
}

export default ImportExportToolbar
