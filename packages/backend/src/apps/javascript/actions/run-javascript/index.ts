import type { IRawAction } from '@plumber/types'

import ivm from 'isolated-vm'

import logger from '@/helpers/logger'

import { parametersSchema } from './schema'

const isolate = new ivm.Isolate({
  onCatastrophicError: logger.error, // TODO: abort all work
})

const action: IRawAction = {
  name: 'Run JavaScript',
  key: 'runJavaScript',
  description: 'Run JavaScript code and be a l33t h4x0r',
  arguments: [
    {
      label: 'Script to run',
      key: 'code',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    const { code } = parametersSchema.parse($.step.parameters)

    const context = await isolate.createContext()
    const script = await isolate.compileScript(code)
    const result = await script.run(context)

    $.setActionItem({
      raw: { result: String(result) },
    })
  },
}

export default action
