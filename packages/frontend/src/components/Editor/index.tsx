import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import EditorRightDrawer from '@/components/EditorRightDrawer'
import { EditorContext } from '@/contexts/Editor'
import { MrfContextProvider } from '@/contexts/MrfContext'
import { StepsToDisplayProvider } from '@/contexts/StepsToDisplay'

import { StepsList } from './components/StepsList'
import { EDITOR_RIGHT_DRAWER_WIDTH } from './constants'
import { editorStyles } from './styles'

type EditorProps = {
  isNested?: boolean
}

export default function Editor(props: EditorProps): React.ReactElement {
  const { isNested } = props
  const { currentStepId, flow } = useContext(EditorContext)
  const currentStep = useMemo(() => {
    return flow.steps.find((step) => step.id === currentStepId)
  }, [currentStepId, flow])

  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  const rightDrawerTransform = isDrawerOpen
    ? 'translateX(0)'
    : 'translateX(100%)'
  const rightDrawerWidth = isDrawerOpen
    ? isMobile
      ? '100vw'
      : EDITOR_RIGHT_DRAWER_WIDTH
    : '0'

  return (
    <Flex
      {...editorStyles.editorWrapper}
      sx={{
        backgroundImage: 'radial-gradient(#f5f5f5 2px, transparent 2px)',
        backgroundSize: '30px 30px',
      }}
    >
      <MrfContextProvider>
        <StepsToDisplayProvider>
          <StepsList isNested={isNested} />
          {/** HACKFIX (kevinkim-ogp): to ensure that the transitions are smooth */}
          <Flex
            {...editorStyles.dummyRightContainer}
            w={rightDrawerWidth}
            transform={rightDrawerTransform}
          />
          <Flex
            {...editorStyles.rightDrawerContainer}
            w={rightDrawerWidth}
            visibility={isDrawerOpen ? 'visible' : 'hidden'}
            opacity={isDrawerOpen ? 1 : 0}
            transform={rightDrawerTransform}
          >
            <EditorRightDrawer step={currentStep} />
          </Flex>
        </StepsToDisplayProvider>
      </MrfContextProvider>
    </Flex>
  )
}
