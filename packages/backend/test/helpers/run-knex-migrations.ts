import { join } from 'path'

import type { Knex } from 'knex'

export async function runKnexMigrations(client: Knex): Promise<void> {
  const [_, migrationsToRun] = await client.migrate.list()
  for (const migrationFile of migrationsToRun) {
    const { file, directory } = migrationFile
    const { up } = await import(join(directory, file))
    await up(client)
  }
}
