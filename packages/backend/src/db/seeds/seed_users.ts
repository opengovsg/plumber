import { randomUUID } from 'crypto'
import { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  await knex('users').insert([
    {
      id: randomUUID(),
      email: 'tester@open.gov.sg',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: randomUUID(),
      email: 'editor@open.gov.sg',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: randomUUID(),
      email: 'viewer@open.gov.sg',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ])
}
