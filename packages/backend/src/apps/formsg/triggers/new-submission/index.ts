import isEmpty from 'lodash/isEmpty';
import { IGlobalVariable } from '@automatisch/types';
import defineTrigger from '../../../../helpers/define-trigger';

export default defineTrigger({
  name: 'New form submission',
  key: 'newSubmission',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',

  async testRun($: IGlobalVariable) {
    if (!isEmpty($.lastExecutionStep?.dataOut)) {
      $.pushTriggerItem({
        raw: $.lastExecutionStep.dataOut,
        meta: {
          internalId: ''
        }
      });
    }
  }
});
