import { IGlobalVariable, IRawAction } from '@plumber/types'

import getDataOutMetadata from '../../triggers/new-submission/get-data-out-metadata'

const action: IRawAction = {
  name: 'New form response',
  key: 'mrfSubmission',
  hiddenFromUser: true,
  description:
    'This is a hidden action that signifies a subsequent MRF submission',
  getDataOutMetadata,

  async testRun(_$: IGlobalVariable) {
    // TODO: this should run testRun for the trigger execution step
  },
}

export default action
