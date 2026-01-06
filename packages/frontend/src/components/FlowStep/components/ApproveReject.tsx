import { useCallback, useContext } from 'react'
import { Flex, Tab, TabList, TabProps, Tabs } from '@chakra-ui/react'

import { MrfContext } from '@/contexts/MrfContext'

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

export function ApproveReject({ stepId }: { stepId: string }) {
  const { approvalBranches, setApprovalBranch } = useContext(MrfContext)

  const isApproveBranch = approvalBranches[stepId] === 'approve'

  const onChange = useCallback(
    (index: number) => {
      setApprovalBranch(stepId, index === 0 ? 'approve' : 'reject')
    },
    [stepId, setApprovalBranch],
  )

  return (
    <Flex mt={4} mx="auto">
      <Tabs
        variant="soft-rounded"
        index={isApproveBranch ? 0 : 1}
        backgroundColor="base.divider.medium"
        borderRadius="full"
        py={1}
        px={0.5}
        onChange={onChange}
      >
        <TabList gap={2}>
          <Tab {...tabStyle('green.500')}>If approved</Tab>
          <Tab {...tabStyle('red.500')}>If rejected</Tab>
        </TabList>
      </Tabs>
    </Flex>
  )
}
