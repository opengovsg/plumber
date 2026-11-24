import type { IRawAction } from '@plumber/types'

import {
  DEFAULT_PROMPT_VALUES,
  PROMPT_PRESETS,
} from '../../common/constants'
import getDataOutMetadata from '../../common/get-data-out-metadata'

const action: IRawAction = {
  name: 'Pair assistant',
  key: 'assistant',
  description: 'Use your own Pair assistant with trained knowledge base',
  // Same prompt and presets as Process text. Outputs are set in Pair, so
  // there is no response fields section.
  arguments: [
    {
      label: 'What should your Pair assistant do?',
      key: 'prompt',
      type: 'rich-text' as const,
      required: true,
      variables: true,
      placeholder: 'Type in your prompt to your assistant here',
      customRteMenuOptions: [],
      presets: PROMPT_PRESETS.map((preset) => ({
        key: preset.key,
        label: preset.label,
        description: preset.description,
        assignments: [
          {
            fieldKey: 'prompt',
            value: DEFAULT_PROMPT_VALUES[preset.key],
          },
        ],
      })),
    },
  ],

  getDataOutMetadata,

  // Local prototype only: returns a canned answer instead of calling Pair.
  async run($) {
    $.setActionItem({
      raw: {
        Answer:
          'Yes. You can take leave on 3 March. Leave of 2 days or fewer does not need approval.',
        Days_requested: 2,
        Needs_approval: 'No',
      },
    })
  },
}

export default action
