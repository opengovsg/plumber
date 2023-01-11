import isEmpty from 'lodash/isEmpty';
import { IGlobalVariable } from '@automatisch/types';
import fetchFormFields from './fetch-form-fields';
import defineTrigger from '../../../../helpers/define-trigger';

export default defineTrigger({
  name: 'New form submission',
  key: 'newSubmission',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',

  async testRun($: IGlobalVariable) {
    if (
      !isEmpty($.lastExecutionStep?.dataOut) &&
      !$.lastExecutionStep.dataOut.isSampleData
    ) {
      $.pushTriggerItem({
        raw: $.lastExecutionStep.dataOut,
        meta: {
          internalId: ''
        }
      });
    } else {
      const sampleData = await fetchFormFields($);
      $.pushTriggerItem({
        raw: {
          submissionId: '5f9f1b5b5c9b9c0011d1b1b3',
          isSampleData: true,
          ...sampleData
        },
        meta: {
          internalId: ''
        }
      });
    }
  }
});
