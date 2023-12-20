import { BiChevronDown, BiExport, BiImport } from 'react-icons/bi'
import { BsFiletypeCsv } from 'react-icons/bs'
import { Flex, Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

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
          <MenuItem fontSize={14} icon={<BsFiletypeCsv size={16} />}>
            CSV
          </MenuItem>
        </MenuList>
      </Menu>
    </Flex>
  )
}

export default ImportExportToolbar
