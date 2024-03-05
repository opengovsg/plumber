import type { IRawAction } from '@plumber/types'

import { PlumberScript } from '@opengovsg/plumberscript'

import { parametersSchema } from './schema'

const action: IRawAction = {
  name: 'Run PlumberScript',
  key: 'runPlumberScript',
  description: 'Run some PlumberScript code and be a l33t h4x0r',
  arguments: [
    {
      label: 'Script to run',
      key: 'script',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    const { script } = parametersSchema.parse($.step.parameters)

    const interpreter = new PlumberScript()
    const result = interpreter.evaluate(script)

    $.setActionItem({
      raw: { result: String(result) },
    })
  },
}

export default action
