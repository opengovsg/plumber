import { useCallback, useContext } from 'react'
import { Flex, Tab, TabList, TabProps, Tabs } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
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
    bg: 'transparent',
    letterSpacing: '0',
    fontWeight: 'medium',
    textTransform: 'none',
    borderRadius: 'md',
    w: '50%',
    px: 4,
    py: 1.5,
    fontSize: 'medium',
  }
}

export function ApproveReject({ stepId }: { stepId: string }) {
  const { setCurrentStepId, onDrawerClose } = useContext(EditorContext)
  const { approvalBranches, setApprovalBranch } = useContext(MrfContext)

  const isApproveBranch = approvalBranches[stepId] === 'approve'

  const onChange = useCallback(
    (index: number) => {
      setApprovalBranch(stepId, index === 0 ? 'approve' : 'reject')
      setCurrentStepId(null)
      onDrawerClose()
    },
    [stepId, setApprovalBranch, setCurrentStepId, onDrawerClose],
  )

  return (
    <Flex onClick={(e) => e.stopPropagation()} w="100%" maxW="600px" px={4}>
      <Tabs
        variant="enclosed-colored"
        index={isApproveBranch ? 0 : 1}
        backgroundColor="base.divider.medium"
        py={1}
        px={0.5}
        borderRadius="md"
        onChange={onChange}
        flex={1}
      >
        <TabList gap={2} overflow="hidden">
          <Tab {...tabStyle('green.500')}>If approved</Tab>
          <Tab {...tabStyle('red.500')}>If rejected</Tab>
        </TabList>
      </Tabs>
    </Flex>
  )
}
