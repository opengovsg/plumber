import dedent from 'dedent'

import { AnnouncementItemProps } from '../AnnouncementItem'
import GraphicAnimation from '../assets/Graphic.json'
import RedesignPipe from '../assets/redesign-pipe.svg'
import WorkflowVisualisation from '../assets/workflow-visualisation.svg'

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
      'Add more context to your workflow by renaming steps - make handovers easier and help others understand what happens in each step.',
    multimedia: {
      animationData: GraphicAnimation,
    },
  },
  {
    title: 'Better workflow visualisation',
    details:
      'View steps within branches when using if then - for a more complete overview of your workflow.',
    multimedia: {
      url: WorkflowVisualisation,
    },
  },
  {
    title: 'Other fixes and improvements',
    details: dedent`
    - ✏️ &nbsp;**Set up steps faster**
      * Added prompts to save your step so you don't lose your work
      * Rearranged fields for easier mapping and readability


    - 🔍 &nbsp;**Find what you need quickly**
      * Sorted apps and tools by categories to help you choose the right ones faster
      * Added quick links to view connected forms and locate your M365 Excel folder


    - ☝️ &nbsp;**One time setup**
      * Created a one-time connection to your M365 account — no repeated connection needed
    `,
  },
]
