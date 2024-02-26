import { v4 as uuidv4 } from 'uuid'

import { client } from './db.mjs'
import { sha256Hash } from './helpers.mjs'

// staging
const FLOW_ID = 'xxx'
const TRIGGER_STEP_ID = 'xxx'
const ACTION_STEP_ID = 'xxx'

const TRIGGER_APP_KEY = 'webhook'
const ACTION_APP_KEY = 'telegram-bot'

const NUMBER_OF_EXECUTIONS = 100

const seedExecutions = async () => {
  const executionsToInsert = []
  const executionStepsToInsert = []
  for (let i = 0; i < NUMBER_OF_EXECUTIONS; i++) {
    const executionId = uuidv4()
    executionsToInsert.push({
      id: executionId,
      flow_id: FLOW_ID,
      test_run: false,
      created_at: new Date(),
      updated_at: new Date(),
      internal_id: sha256Hash(uuidv4()),
      deleted_at: null,
    })
    executionStepsToInsert.push({
      id: uuidv4(),
      execution_id: executionId,
      step_id: TRIGGER_STEP_ID,
      status: 'success',
      data_in:
        '{"url": "https://mock.codes/200", "data": "", "apiUrl": "https://mock.codes/200", "method": "GET", "headers": ""}',
      data_out: '{"data": {"statusCode": 200, "description": "OK"}}',
      app_key: TRIGGER_APP_KEY,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    })
    executionStepsToInsert.push({
      id: uuidv4(),
      execution_id: executionId,
      step_id: ACTION_STEP_ID,
      status: 'success',
      data_in: '{}',
      data_out: '{}',
      app_key: ACTION_APP_KEY,
      created_at: new Date(new Date().getTime() + 1),
      updated_at: new Date(),
      deleted_at: null,
    })
  }
  console.log('inserting executions')
  console.time('inserting executions')
  await client.batchInsert('executions', executionsToInsert, 100)
  console.timeEnd('inserting executions')
  console.log(`${executionsToInsert.length} execution inserted`)
  console.time('inserting execution steps')
  await client.batchInsert('execution_steps', executionStepsToInsert, 100)
  console.log(`${executionStepsToInsert.length} execution steps inserted`)
  console.timeEnd('inserting execution steps')
  process.exit(0)
}

seedExecutions()
