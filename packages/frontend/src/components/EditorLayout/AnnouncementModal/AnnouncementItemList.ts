import dedent from 'dedent'

import GraphicAnimation from './assets/Graphic.json'
import RedesignPipe from './assets/redesign-pipe.svg'
import WorkflowVisualisation from './assets/workflow-visualisation.svg'
import { AnnouncementItemProps } from './AnnouncementItem'

export const ANNOUNCEMENT_ITEM_LIST: AnnouncementItemProps[] = [
  {
    title: 'Redesigned pipe building experience',
    details:
      'Set up steps on the side without losing an overview of your workflow. This helps to reduce the need to scroll up and down to reference previous steps and also to focus your attention on setting up the current step.',
    multimedia: {
      url: RedesignPipe,
    },
  },
  {
    title: 'Rename your steps',
    details:
      'Add more context to your workflow by renaming steps - make handovers easier and explain to others what happens in each step.',
    multimedia: {
      animationData: GraphicAnimation,
    },
  },
  {
    title: 'Better workflow visualisation',
    details:
      'See steps within branches for pipes using conditional logic - get a more complete overview of your workflow.',
    multimedia: {
      url: WorkflowVisualisation,
    },
  },
  {
    title: 'Other fixes and improvements',
    details: dedent`
      - Sorted apps and tools by categories to give you a better idea of what to use them for
      - Added prompts to save your step
      - Added a link to view connected forms quickly
      - Added a link to locate your M365 Excel folder quickly
      - Created one-time connection to your M365 account
      - Rearranged fields for easier mapping/better readability
    `,
  },
]
