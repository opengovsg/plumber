import { useState } from 'react'
import { Flex, Tab, TabList, TabProps, Tabs } from '@chakra-ui/react'

const tabStyle = (primaryColor: string): TabProps => {
  return {
    _selected: {
      color: 'white',
      bg: primaryColor,
      _hover: {
        color: 'white',
      },
    },
    _hover: {
      color: primaryColor,
    },
    letterSpacing: '0',
    fontWeight: 'medium',
    textTransform: 'none',
    px: 4,
    fontSize: 'medium',
  }
}

export function ApproveReject() {
  const [isApprovedSelected, setIsApprovedSelected] = useState(true)

  return (
    <Flex mt={4} mx="auto">
      <Tabs
        variant="soft-rounded"
        index={isApprovedSelected ? 0 : 1}
        backgroundColor="base.divider.medium"
        borderRadius="full"
        py={1}
        px={0.5}
        onChange={(index) => setIsApprovedSelected(index === 0)}
      >
        <TabList gap={2}>
          <Tab {...tabStyle('green.500')}>If approved</Tab>
          <Tab {...tabStyle('red.500')}>If rejected</Tab>
        </TabList>
      </Tabs>
    </Flex>
  )
}
